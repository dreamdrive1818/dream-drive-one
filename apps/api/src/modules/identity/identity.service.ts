import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma, RoleName, UserStatus } from "@prisma/client";
import { createHash, timingSafeEqual } from "crypto";
import { prisma } from "../../lib/prisma";
import {
  firebaseSignInWithPassword,
  firebaseSignUpWithPassword,
  verifyGoogleOrFirebaseIdToken,
} from "../../lib/firebase-rest";
import { mintSessionToken } from "../../lib/session-token";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_WINDOW_MS = 15 * 60 * 1000;
const OTP_MAX_SEND = 3;
const OTP_MAX_ATTEMPTS = 5;
const memoryOtp = new Map<
  string,
  { codeHash: string; expiresAt: number; attempts: number; windowStart: number; windowCount: number }
>();
const pendingPhones = new Map<string, string>();
const STAFF_ROLES: RoleName[] = [
  "SUPPORT",
  "SALES",
  "FLEET_OPS",
  "FINANCE",
  "BRANCH_MANAGER",
  "CITY_MANAGER",
  "SUPER_ADMIN",
];

function hashOtp(email: string, code: string) {
  const secret = process.env.SESSION_SECRET || process.env.INTERNAL_TOKEN || "dev-internal";
  return createHash("sha256").update(`${email}:${code}:${secret}`).digest("hex");
}

function hashesMatch(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

@Injectable()
export class IdentityService {
  async upsertFromIdentity(input: {
    firebaseUid: string;
    email: string;
    phone?: string | null;
    fullName?: string;
    ip?: string;
  }) {
    const email = input.email.toLowerCase().trim();
    const existing = await prisma.user.findFirst({
      where: { OR: [{ firebaseUid: input.firebaseUid }, { email }] },
      include: { roles: { include: { role: true } }, profile: true },
    });

    if (existing) {
      if (existing.status === UserStatus.DISABLED) {
        throw new UnauthorizedException("Account disabled");
      }
      const user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          firebaseUid: input.firebaseUid,
          email,
          phone: input.phone ?? existing.phone,
        },
        include: { roles: { include: { role: true } }, profile: true, staffScopes: true },
      });
      return this.present(user);
    }

    const customerRole = await this.ensureRole("CUSTOMER");
    const user = await prisma.user.create({
      data: {
        firebaseUid: input.firebaseUid,
        email,
        phone: input.phone ?? undefined,
        profile: {
          create: { fullName: input.fullName ?? email.split("@")[0] },
        },
        roles: { create: { roleId: customerRole.id } },
        wallet: { create: { balancePaise: 0 } },
        loyalty: { create: { points: 0 } },
      },
      include: { roles: { include: { role: true } }, profile: true, staffScopes: true },
    });
    await this.audit({
      actorId: user.id,
      action: "auth.sync",
      entityId: user.id,
      ip: input.ip,
    });
    return this.present(user);
  }

  async byFirebaseUid(firebaseUid: string) {
    const user = await prisma.user.findUnique({
      where: { firebaseUid },
      include: { roles: { include: { role: true } }, profile: true, staffScopes: true },
    });
    return user ? this.present(user) : null;
  }

  async byEmail(email: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { roles: { include: { role: true } }, profile: true, staffScopes: true },
    });
    return user ? this.present(user) : null;
  }

  async me(userId: string, opts: { allowDisabled?: boolean } = {}) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        profile: true,
        addresses: true,
        staffScopes: true,
      },
    });
    if (!user) throw new NotFoundException("User not found");
    if (user.status === UserStatus.DISABLED && !opts.allowDisabled) {
      throw new UnauthorizedException("Account disabled");
    }
    return this.present(user);
  }

  async patchMe(
    userId: string,
    body: { fullName?: string; phone?: string; address?: Record<string, string> },
    opts: { adminOverride?: boolean } = {}
  ) {
    const current = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!current) throw new NotFoundException("User not found");
    const kycApproved = current.profile?.kycStatus === "APPROVED";

    if (body.fullName != null) {
      const next = normalizeName(body.fullName);
      if (!next) throw new BadRequestException("Name is required");
      if (kycApproved && !opts.adminOverride && !namesMatch(next, current.profile?.fullName ?? "")) {
        throw new ForbiddenException(
          "Name is locked to the approved KYC record. Contact support to change it."
        );
      }
      await prisma.customerProfile.upsert({
        where: { userId },
        create: { userId, fullName: next },
        update: { fullName: next },
      });
    }

    let otpCode: string | undefined;
    let pendingPhone: string | null = pendingPhones.get(userId) ?? current.profile?.pendingPhone ?? null;
    if (body.phone != null && body.phone !== "") {
      const phone = normalizePhone(body.phone);
      if (phone !== current.phone) {
        const taken = await prisma.user.findFirst({
          where: { phone, NOT: { id: userId } },
        });
        if (taken) throw new BadRequestException("Phone already in use");
        if (opts.adminOverride) {
          await prisma.user.update({ where: { id: userId }, data: { phone } });
          pendingPhones.delete(userId);
          await prisma.customerProfile.updateMany({ where: { userId }, data: { pendingPhone: null } });
          pendingPhone = null;
        } else {
          pendingPhones.set(userId, phone);
          await prisma.customerProfile.upsert({
            where: { userId },
            create: { userId, fullName: current.profile?.fullName || current.email, pendingPhone: phone },
            update: { pendingPhone: phone },
          });
          otpCode = await this.issueOtp(current.email);
          pendingPhone = phone;
        }
      }
    }

    if (body.address?.line1) {
      await this.upsertAddress(userId, body.address);
    }

    const user = await this.me(userId);
    return { user, otpCode, pendingPhone };
  }

  async confirmPhoneChange(userId: string, code: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException("User not found");
    const pending = pendingPhones.get(userId) ?? user.profile?.pendingPhone ?? null;
    if (!pending) throw new BadRequestException("No phone change is pending");
    await this.assertOtp(user.email, code);
    const taken = await prisma.user.findFirst({
      where: { phone: pending, NOT: { id: userId } },
    });
    if (taken) throw new BadRequestException("Phone already in use");
    await prisma.user.update({ where: { id: userId }, data: { phone: pending } });
    pendingPhones.delete(userId);
    await prisma.customerProfile.updateMany({ where: { userId }, data: { pendingPhone: null } });
    await this.audit({
      actorId: userId,
      action: "profile.phone",
      entityId: userId,
      payload: { phone: pending },
    });
    return this.me(userId);
  }

  async addAddress(userId: string, body: Record<string, string | boolean | undefined>) {
    return this.upsertAddress(userId, body);
  }

  async updateAddress(
    userId: string,
    addressId: string,
    body: Record<string, string | boolean | undefined>
  ) {
    const row = await prisma.address.findUnique({ where: { id: addressId } });
    if (!row || row.userId !== userId) throw new NotFoundException("Address not found");
    if (body.isDefault === true || body.isDefault === "true") {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    await prisma.address.update({
      where: { id: addressId },
      data: {
        line1: String(body.line1 ?? row.line1),
        line2: body.line2 == null ? row.line2 : String(body.line2),
        city: String(body.city ?? row.city),
        state: String(body.state ?? row.state),
        zip: String(body.zip ?? row.zip),
        country: String(body.country ?? row.country ?? "IN"),
        isDefault: body.isDefault === true || body.isDefault === "true" || row.isDefault,
      },
    });
    return this.me(userId);
  }

  async deleteAddress(userId: string, addressId: string) {
    const row = await prisma.address.findUnique({ where: { id: addressId } });
    if (!row || row.userId !== userId) throw new NotFoundException("Address not found");
    await prisma.address.delete({ where: { id: addressId } });
    return this.me(userId);
  }

  async dashboard(userId: string) {
    const profile = await this.me(userId);
    const [bookings, kyc, agreements, invoices, tickets, wallet, subscriptions] = await Promise.all([
      prisma.booking.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          payments: true,
          kycCase: { select: { id: true, status: true } },
          agreements: { select: { id: true, status: true, pdfUrl: true, signedPdfUrl: true } },
          pickupBranch: { select: { id: true, name: true } },
          subscription: { select: { id: true, status: true, swapDueReason: true } },
        },
      }),
      prisma.kycCase.findMany({
        where: { userId },
        include: { documents: true },
        orderBy: { id: "desc" },
        take: 10,
      }),
      prisma.agreement.findMany({
        where: { booking: { userId } },
        include: { envelope: true, booking: { select: { publicId: true, status: true } } },
        orderBy: { id: "desc" },
        take: 20,
      }),
      prisma.invoice.findMany({
        where: { booking: { userId } },
        include: { booking: { select: { publicId: true, status: true } }, lines: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.ticket.findMany({
        where: { userId },
        include: { messages: { where: { internal: false }, orderBy: { createdAt: "asc" } } },
        orderBy: { id: "desc" },
        take: 10,
      }),
      prisma.wallet.upsert({
        where: { userId },
        create: { userId, balancePaise: 0 },
        update: {},
      }),
      prisma.subscription.findMany({
        where: { booking: { userId }, status: { in: ["ACTIVE", "PAUSED"] } },
        include: {
          plan: { select: { id: true, months: true, swapAllowed: true, maintenanceIncl: true } },
          booking: {
            select: {
              publicId: true,
              status: true,
              vehicle: { select: { id: true, registration: true, status: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);
    const models = await this.carModelsFor(bookings.map((b) => b.carModelId));
    return {
      profile,
      bookings: bookings.map((b) => ({ ...b, carModel: models.get(b.carModelId) ?? null })),
      subscriptions,
      documents: { kycStatus: profile.kycStatus, kyc, agreements },
      invoices,
      tickets,
      wallet,
    };
  }

  async adminCustomer(id: string) {
    const profile = await this.me(id, { allowDisabled: true });
    const [bookings, kyc, agreements, invoices, tickets, notes] = await Promise.all([
      prisma.booking.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          payments: true,
          kycCase: { select: { id: true, status: true } },
          agreements: { select: { id: true, status: true } },
        },
      }),
      prisma.kycCase.findMany({
        where: { userId: id },
        include: { documents: true, booking: { select: { publicId: true } } },
        orderBy: { id: "desc" },
      }),
      prisma.agreement.findMany({
        where: { booking: { userId: id } },
        include: { envelope: true, booking: { select: { publicId: true } } },
      }),
      prisma.invoice.findMany({
        where: { booking: { userId: id } },
        include: { lines: true, booking: { select: { publicId: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.ticket.findMany({
        where: { userId: id },
        include: { messages: { orderBy: { createdAt: "asc" } } },
        orderBy: { id: "desc" },
      }),
      prisma.auditLog.findMany({
        where: { entity: "User", entityId: id, action: { in: ["customer.note", "profile.phone", "profile.name", "kyc.reset"] } },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { actor: { select: { email: true } } },
      }),
    ]);
    return {
      ...profile,
      bookings,
      documents: { kycStatus: profile.kycStatus, kyc, agreements },
      invoices,
      tickets,
      notes,
    };
  }

  async addCustomerNote(actorId: string, userId: string, note: string, ip?: string) {
    if (!note?.trim()) throw new BadRequestException("Note is required");
    await this.me(userId);
    await this.audit({
      actorId,
      action: "customer.note",
      entityId: userId,
      payload: { note: note.trim() },
      ip,
    });
    return this.adminCustomer(userId);
  }

  async overrideName(actorId: string, userId: string, fullName: string, ip?: string) {
    const { user } = await this.patchMe(userId, { fullName }, { adminOverride: true });
    await this.audit({
      actorId,
      action: "profile.name",
      entityId: userId,
      payload: { fullName: user.fullName },
      ip,
    });
    return user;
  }

  async registerDevice(userId: string, token: string, platform: string) {
    return prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform: platform || "web" },
      update: { userId, platform: platform || "web" },
    });
  }

  private async loadOtp(email: string) {
    try {
      const row = await prisma.emailOtp.findUnique({ where: { email } });
      if (!row) return null;
      return {
        codeHash: row.codeHash,
        expiresAt: row.expiresAt.getTime(),
        attempts: row.attempts,
        windowStart: row.windowStart.getTime(),
        windowCount: row.windowCount,
      };
    } catch {
      return memoryOtp.get(email) ?? null;
    }
  }

  private async saveOtp(
    email: string,
    data: {
      codeHash: string;
      expiresAt: Date;
      attempts: number;
      windowStart: Date;
      windowCount: number;
    }
  ) {
    try {
      await prisma.emailOtp.upsert({
        where: { email },
        create: { email, ...data },
        update: data,
      });
    } catch {
      memoryOtp.set(email, {
        codeHash: data.codeHash,
        expiresAt: data.expiresAt.getTime(),
        attempts: data.attempts,
        windowStart: data.windowStart.getTime(),
        windowCount: data.windowCount,
      });
    }
  }

  private async clearOtp(email: string) {
    memoryOtp.delete(email);
    await prisma.emailOtp.delete({ where: { email } }).catch(() => undefined);
  }

  async issueOtp(emailRaw: string) {
    const email = emailRaw.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException("Valid email required");
    }
    const now = new Date();
    const existing = await this.loadOtp(email);
    let windowStart = existing ? new Date(existing.windowStart) : now;
    let windowCount = existing?.windowCount ?? 0;
    if (now.getTime() - windowStart.getTime() > OTP_WINDOW_MS) {
      windowStart = now;
      windowCount = 0;
    }
    if (windowCount >= OTP_MAX_SEND) {
      throw new BadRequestException("Too many OTP requests. Try again in 15 minutes.");
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.saveOtp(email, {
      codeHash: hashOtp(email, code),
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      attempts: 0,
      windowStart,
      windowCount: windowCount + 1,
    });
    return code;
  }

  async verifyOtp(emailRaw: string, code: string, ip?: string) {
    const email = emailRaw.toLowerCase().trim();
    const row = await this.loadOtp(email);
    if (!row || row.expiresAt < Date.now()) {
      throw new BadRequestException("Invalid or expired OTP");
    }
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      await this.clearOtp(email);
      throw new BadRequestException("Too many attempts. Request a new OTP.");
    }
    if (!hashesMatch(row.codeHash, hashOtp(email, code.trim()))) {
      await this.saveOtp(email, {
        codeHash: row.codeHash,
        expiresAt: new Date(row.expiresAt),
        attempts: row.attempts + 1,
        windowStart: new Date(row.windowStart),
        windowCount: row.windowCount,
      });
      throw new BadRequestException("Invalid or expired OTP");
    }
    await this.clearOtp(email);
    const existing = await prisma.user.findUnique({ where: { email } });
    const user = await this.upsertFromIdentity({
      firebaseUid: existing?.firebaseUid ?? `otp:${email}`,
      email,
      fullName: existing?.email ? undefined : email.split("@")[0],
      ip,
    });
    await this.audit({
      actorId: user.id,
      action: "auth.otp",
      entityId: user.id,
      ip,
    });
    return {
      ok: true,
      token: mintSessionToken({ email: user.email, uid: user.firebaseUid }),
      user,
    };
  }


  async loginWithPassword(email: string, password: string, ip?: string) {
    const fb = await firebaseSignInWithPassword(email, password);
    const user = await this.upsertFromIdentity({
      firebaseUid: fb.uid,
      email: fb.email,
      fullName: fb.name,
      ip,
    });
    await this.audit({ actorId: user.id, action: "auth.login", entityId: user.id, ip });
    return { token: fb.idToken, user };
  }

  async registerWithPassword(
    email: string,
    password: string,
    fullName?: string,
    ip?: string
  ) {
    if (!password || password.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters");
    }
    const fb = await firebaseSignUpWithPassword(email, password);
    const user = await this.upsertFromIdentity({
      firebaseUid: fb.uid,
      email: fb.email,
      fullName: fullName || fb.name,
      ip,
    });
    await this.audit({ actorId: user.id, action: "auth.register", entityId: user.id, ip });
    return { token: fb.idToken, user };
  }

  async loginWithGoogle(idToken: string, ip?: string) {
    const google = await verifyGoogleOrFirebaseIdToken(idToken);
    const user = await this.upsertFromIdentity({
      firebaseUid: google.uid,
      email: google.email,
      fullName: google.name,
      ip,
    });
    await this.audit({ actorId: user.id, action: "auth.google", entityId: user.id, ip });
    return {
      token: mintSessionToken({ email: user.email, uid: user.firebaseUid }),
      user,
    };
  }

  async listUsers(
    actor: { roles: string[]; assignedCityId?: string | null },
    q?: string,
    take = 100,
    opts?: { staff?: boolean; role?: string }
  ) {
    const limit = Math.min(Math.max(Number(take) || 100, 1), 200);
    const term = q?.trim();
    const superAdmin = actor.roles.includes("SUPER_ADMIN");
    const cityId = actor.assignedCityId || null;
    return prisma.user.findMany({
      where: {
        ...(term
          ? {
              OR: [
                { email: { contains: term, mode: "insensitive" } },
                { phone: { contains: term } },
                { profile: { fullName: { contains: term, mode: "insensitive" } } },
              ],
            }
          : {}),
        ...(opts?.staff
          ? { roles: { some: { role: { name: { not: "CUSTOMER" } } } } }
          : opts?.role
            ? { roles: { some: { role: { name: opts.role as RoleName } } } }
            : {}),
        ...(!superAdmin
          ? cityId
            ? { staffScopes: { some: { cityId } } }
            : { id: { in: [] } }
          : {}),
      },
      include: { roles: { include: { role: true } }, profile: true, staffScopes: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }).then((rows) => rows.map((u) => this.present(u)));
  }

  async setRoles(actorId: string, userId: string, roles: RoleName[], ip?: string) {
    if (!roles.length) throw new BadRequestException("At least one role required");
    const unique = [...new Set(roles)];
    await this.assertNotLastSuperAdmin(userId, unique);
    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      for (const name of unique) {
        const role = await tx.role.upsert({
          where: { name },
          update: {},
          create: { name },
        });
        await tx.userRole.create({ data: { userId, roleId: role.id } });
      }
    });
    await this.audit({
      actorId,
      action: "user.roles",
      entityId: userId,
      payload: { roles: unique },
      ip,
    });
    return this.me(userId);
  }

  async inviteStaff(
    actorId: string,
    input: {
      email: string;
      fullName?: string;
      roles?: RoleName[];
      cityId?: string;
      branchId?: string;
    },
    ip?: string
  ) {
    const actor = await this.me(actorId);
    const email = input.email.toLowerCase().trim();
    const roles = [...new Set(input.roles?.length ? input.roles : (["SUPPORT"] as RoleName[]))];
    if (!roles.some((r) => STAFF_ROLES.includes(r))) {
      throw new BadRequestException("Invite requires a staff role");
    }
    const actorIsSuper = actor.roles.includes("SUPER_ADMIN");
    if (!actorIsSuper) {
      if (roles.includes("SUPER_ADMIN") || roles.includes("CITY_MANAGER")) {
        throw new ForbiddenException("City managers cannot invite SUPER_ADMIN or CITY_MANAGER");
      }
      if (!actor.cityId) throw new ForbiddenException("Assign yourself a city before inviting staff");
    }
    let cityId = input.cityId || null;
    let branchId = input.branchId || null;
    if (!actorIsSuper) {
      cityId = actor.cityId;
      if (branchId) {
        const branch = await prisma.branch.findUnique({ where: { id: branchId } });
        if (!branch || branch.cityId !== actor.cityId) {
          throw new ForbiddenException("Branch is outside your city");
        }
      }
    }
    if (roles.includes("CITY_MANAGER") && !cityId) {
      throw new BadRequestException("City manager must be assigned a city");
    }
    if (roles.includes("BRANCH_MANAGER") && !branchId) {
      throw new BadRequestException("Branch manager must be assigned a branch");
    }
    if (!actorIsSuper && !roles.includes("SUPER_ADMIN") && !cityId) {
      throw new BadRequestException("Staff must be assigned a city");
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    const user = existing
      ? await this.upsertFromIdentity({
          firebaseUid: existing.firebaseUid,
          email,
          fullName: input.fullName,
          ip,
        })
      : await this.upsertFromIdentity({
          firebaseUid: `invited:${email}`,
          email,
          fullName: input.fullName ?? email.split("@")[0],
          ip,
        });
    await this.setRoles(actorId, user.id, roles, ip);
    if (cityId || branchId) {
      await prisma.staffScope.deleteMany({ where: { userId: user.id } });
      await prisma.staffScope.create({
        data: {
          userId: user.id,
          cityId,
          branchId,
        },
      });
    }
    await this.audit({
      actorId,
      action: "user.invite",
      entityId: user.id,
      payload: { email, roles, cityId, branchId },
      ip,
    });
    return this.me(user.id);
  }

  async setScope(
    actorId: string,
    userId: string,
    input: { cityId?: string | null; branchId?: string | null },
    ip?: string
  ) {
    const actor = await this.me(actorId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException("User not found");
    const targetRoles = user.roles.map((r) => r.role.name);
    const actorIsSuper = actor.roles.includes("SUPER_ADMIN");
    let cityId = input.cityId || null;
    let branchId = input.branchId || null;
    if (branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch) throw new NotFoundException("Branch not found");
      cityId = cityId || branch.cityId;
      if (cityId && branch.cityId !== cityId) {
        throw new BadRequestException("Branch does not belong to that city");
      }
    }
    if (!actorIsSuper) {
      if (!actor.cityId) throw new ForbiddenException("Assign yourself a city first");
      if (targetRoles.includes("SUPER_ADMIN")) {
        throw new ForbiddenException("Cannot change a super admin's scope");
      }
      cityId = actor.cityId;
      if (branchId) {
        const branch = await prisma.branch.findUnique({ where: { id: branchId } });
        if (!branch || branch.cityId !== actor.cityId) {
          throw new ForbiddenException("Branch is outside your city");
        }
      }
    }
    if (targetRoles.includes("CITY_MANAGER") && !cityId) {
      throw new BadRequestException("City manager must keep a city assignment");
    }
    await prisma.staffScope.deleteMany({ where: { userId } });
    if (cityId || branchId) {
      await prisma.staffScope.create({
        data: { userId, cityId, branchId },
      });
    }
    await this.audit({
      actorId,
      action: "user.scope",
      entityId: userId,
      payload: { cityId, branchId },
      ip,
    });
    return this.me(userId);
  }

  async resolveOpsScope(
    user: { roles: string[]; cityId?: string | null; branchId?: string | null },
    requestedCityId?: string,
    requestedBranchId?: string
  ) {
    const reqCity = String(requestedCityId || "").trim();
    const reqBranch = String(requestedBranchId || "").trim();
    const roles = user.roles || [];

    if (roles.includes("SUPER_ADMIN")) {
      if (reqBranch) {
        const branch = await prisma.branch.findUnique({ where: { id: reqBranch } });
        if (!branch) return { cityId: reqCity || null, branchId: null };
        if (reqCity && branch.cityId !== reqCity) return { cityId: reqCity, branchId: null };
        return { cityId: branch.cityId, branchId: branch.id };
      }
      return { cityId: reqCity || null, branchId: null };
    }

    if (roles.includes("CITY_MANAGER") && user.cityId) {
      if (reqBranch) {
        const branch = await prisma.branch.findUnique({ where: { id: reqBranch } });
        if (branch && branch.cityId === user.cityId) {
          return { cityId: user.cityId, branchId: branch.id };
        }
      }
      return { cityId: user.cityId, branchId: null };
    }

    return { cityId: user.cityId || null, branchId: user.branchId || null };
  }

  async disable(actorId: string, userId: string, ip?: string) {
    if (actorId === userId) {
      throw new BadRequestException("You cannot disable your own account");
    }
    await this.assertNotLastSuperAdmin(userId, []);
    const user = await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.DISABLED },
    });
    await this.audit({ actorId, action: "user.disable", entityId: userId, ip });
    return { id: user.id, status: user.status };
  }

  async auditLog(take = 100) {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(take, 1), 500),
      include: { actor: { select: { email: true } } },
    });
  }

  private async assertNotLastSuperAdmin(userId: string, nextRoles: RoleName[]) {
    if (nextRoles.includes("SUPER_ADMIN")) return;
    const target = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    const wasSuper = target?.roles.some((r) => r.role.name === "SUPER_ADMIN");
    if (!wasSuper) return;
    const supers = await prisma.userRole.count({
      where: {
        role: { name: "SUPER_ADMIN" },
        user: { status: UserStatus.ACTIVE },
      },
    });
    if (supers <= 1) {
      throw new BadRequestException("Cannot remove or disable the last super admin");
    }
  }

  private async audit(input: {
    actorId?: string;
    action: string;
    entityId?: string;
    payload?: Prisma.InputJsonValue;
    ip?: string;
  }) {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entity: "User",
        entityId: input.entityId,
        payload: input.payload,
        ip: input.ip,
      },
    });
  }

  async assertOtp(emailRaw: string, code: string) {
    const email = emailRaw.toLowerCase().trim();
    const row = await this.loadOtp(email);
    if (!row || row.expiresAt < Date.now()) {
      throw new BadRequestException("Invalid or expired OTP");
    }
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      await this.clearOtp(email);
      throw new BadRequestException("Too many attempts. Request a new OTP.");
    }
    if (!hashesMatch(row.codeHash, hashOtp(email, code.trim()))) {
      await this.saveOtp(email, {
        codeHash: row.codeHash,
        expiresAt: new Date(row.expiresAt),
        attempts: row.attempts + 1,
        windowStart: new Date(row.windowStart),
        windowCount: row.windowCount,
      });
      throw new BadRequestException("Invalid or expired OTP");
    }
    await this.clearOtp(email);
  }

  private async upsertAddress(userId: string, body: Record<string, string | boolean | undefined>) {
    const line1 = String(body.line1 ?? "").trim();
    if (!line1) throw new BadRequestException("Address line 1 is required");
    const isDefault = body.isDefault !== false && body.isDefault !== "false";
    if (isDefault) {
      await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    const created = await prisma.address.create({
      data: {
        userId,
        line1,
        line2: body.line2 ? String(body.line2) : undefined,
        city: String(body.city ?? ""),
        state: String(body.state ?? ""),
        zip: String(body.zip ?? ""),
        country: String(body.country ?? "IN"),
        isDefault,
      },
    });
    return { ...created, profile: await this.me(userId) };
  }

  private async carModelsFor(ids: string[]) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return new Map<string, { id: string; name: string; slug: string; images: { url: string }[] }>();
    const rows = await prisma.carModel.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true, slug: true, images: { select: { url: true }, take: 1, orderBy: { sortOrder: "asc" } } },
    });
    return new Map(rows.map((m) => [m.id, m]));
  }

  private async ensureRole(name: RoleName) {
    const found = await prisma.role.findUnique({ where: { name } });
    if (found) return found;
    return prisma.role.create({ data: { name } });
  }

  private present(user: {
    id: string;
    firebaseUid: string;
    email: string;
    phone: string | null;
    status: UserStatus;
    createdAt: Date;
    roles: { role: { name: RoleName } }[];
    profile?: {
      fullName: string;
      kycStatus: string;
      pendingPhone?: string | null;
      kycValidUntil?: Date | null;
    } | null;
    addresses?: unknown;
    staffScopes?: { cityId: string | null; branchId: string | null }[];
  }) {
    const roles = user.roles.map((r) => r.role.name);
    const scope = user.staffScopes?.[0];
    const kycStatus = user.profile?.kycStatus ?? "NOT_STARTED";
    const isSuperAdmin = roles.includes("SUPER_ADMIN");
    const isCityManager = roles.includes("CITY_MANAGER");
    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      phone: user.phone,
      pendingPhone: user.profile?.pendingPhone ?? pendingPhones.get(user.id) ?? null,
      status: user.status,
      createdAt: user.createdAt,
      fullName: user.profile?.fullName ?? null,
      kycStatus,
      kycValidUntil: user.profile?.kycValidUntil ?? null,
      nameLocked: kycStatus === "APPROVED",
      roles,
      cityId: scope?.cityId ?? null,
      branchId: scope?.branchId ?? null,
      canSwitchCity: isSuperAdmin,
      canSwitchBranch: isSuperAdmin || isCityManager,
      addresses: user.addresses,
    };
  }
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function namesMatch(a: string, b: string) {
  return normalizeName(a).toLowerCase() === normalizeName(b).toLowerCase();
}

function normalizePhone(raw: string) {
  const digits = String(raw).replace(/\D/g, "");
  let phone = digits;
  if (phone.length === 12 && phone.startsWith("91")) phone = phone.slice(2);
  if (phone.length === 11 && phone.startsWith("0")) phone = phone.slice(1);
  if (!/^[6-9]\d{9}$/.test(phone)) {
    throw new BadRequestException("Enter a valid 10-digit Indian mobile number");
  }
  return phone;
}
