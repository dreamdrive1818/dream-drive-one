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
import { dashboardCacheKey, invalidateUserProfile, meCacheKey, remember } from "../../lib/cache";
import {
  firebaseSignInWithPassword,
  firebaseSignUpWithPassword,
  verifyGoogleOrFirebaseIdToken,
  verifyFacebookAccessToken,
} from "../../lib/firebase-rest";
import { mintSessionToken, allowDevAuthBypass } from "../../lib/session-token";
import { hashPassword, verifyPassword, generateStaffPassword } from "../../lib/password";
import {
  assertAuthMethod,
  assertCanCreateViaOtp,
  assertCanCreateViaSocial,
  getAuthSettings,
} from "../../lib/auth-settings";

const BOOTSTRAP_ADMIN_EMAIL = (process.env.ADMIN_BOOTSTRAP_EMAIL || "admin@dreamdrive.test").toLowerCase();
const BOOTSTRAP_ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD || "admin@123";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_WINDOW_MS = 15 * 60 * 1000;
const OTP_MAX_SEND = 3;
const OTP_MAX_ATTEMPTS = 5;
const memoryOtp = new Map<
  string,
  { codeHash: string; expiresAt: number; attempts: number; windowStart: number; windowCount: number }
>();
const pendingPhones = new Map<string, string>();
const DEV_STAFF: Record<string, RoleName> = {
  "admin@dreamdrive.test": "SUPER_ADMIN",
  "fleet@dreamdrive.test": "FLEET_OPS",
  "finance@dreamdrive.test": "FINANCE",
  "branch@dreamdrive.test": "BRANCH_MANAGER",
  "city@dreamdrive.test": "CITY_MANAGER",
};

const DEV_STAFF_NAMES: Record<string, string> = {
  "admin@dreamdrive.test": "Super Admin",
  "fleet@dreamdrive.test": "Fleet Ops",
  "finance@dreamdrive.test": "Finance",
  "branch@dreamdrive.test": "Ranchi Branch Manager",
  "city@dreamdrive.test": "Ranchi City Manager",
};

const STAFF_ROLES: RoleName[] = [
  "SUPPORT",
  "SALES",
  "FLEET_OPS",
  "FINANCE",
  "BRANCH_MANAGER",
  "CITY_MANAGER",
  "SUPER_ADMIN",
];

const STAFF_SCOPE_INCLUDE = {
  include: {
    city: { select: { id: true, name: true } },
    branch: { select: { id: true, name: true } },
  },
} as const;

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
      include: { roles: { include: { role: true } }, profile: true, staffScopes: STAFF_SCOPE_INCLUDE },
    });

    if (existing) {
      if (existing.status === UserStatus.DISABLED) {
        throw new UnauthorizedException("Account disabled");
      }
      const nextPhone = input.phone ?? existing.phone;
      if (
        existing.firebaseUid === input.firebaseUid &&
        existing.email === email &&
        existing.phone === nextPhone
      ) {
        return this.present(existing);
      }
      const user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          firebaseUid: input.firebaseUid,
          email,
          phone: nextPhone,
        },
        include: { roles: { include: { role: true } }, profile: true, staffScopes: STAFF_SCOPE_INCLUDE },
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
      include: { roles: { include: { role: true } }, profile: true, staffScopes: STAFF_SCOPE_INCLUDE },
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
      include: { roles: { include: { role: true } }, profile: true, staffScopes: STAFF_SCOPE_INCLUDE },
    });
    return user ? this.present(user) : null;
  }

  async byEmail(email: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { roles: { include: { role: true } }, profile: true, staffScopes: STAFF_SCOPE_INCLUDE },
    });
    return user ? this.present(user) : null;
  }

  async me(userId: string, opts: { allowDisabled?: boolean } = {}) {
    if (opts.allowDisabled) return this.meUncached(userId, opts);
    return remember(meCacheKey(userId), 60, () => this.meUncached(userId, opts));
  }

  private async meUncached(userId: string, opts: { allowDisabled?: boolean } = {}) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        profile: true,
        addresses: true,
        staffScopes: STAFF_SCOPE_INCLUDE,
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

    await invalidateUserProfile(userId);
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
    await invalidateUserProfile(userId);
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
    await invalidateUserProfile(userId);
    return this.me(userId);
  }

  async deleteAddress(userId: string, addressId: string) {
    const row = await prisma.address.findUnique({ where: { id: addressId } });
    if (!row || row.userId !== userId) throw new NotFoundException("Address not found");
    await prisma.address.delete({ where: { id: addressId } });
    await invalidateUserProfile(userId);
    return this.me(userId);
  }

  async dashboard(userId: string) {
    return remember(dashboardCacheKey(userId), 45, () => this.dashboardUncached(userId));
  }

  private async dashboardUncached(userId: string) {
    const [profile, bookings, kyc, agreements, invoices, tickets, wallet, subscriptions, modelRows] = await Promise.all([
      this.me(userId),
      prisma.booking.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          publicId: true,
          carModelId: true,
          startsAt: true,
          endsAt: true,
          amountPaise: true,
          status: true,
        },
      }),
      prisma.kycCase.findMany({
        where: { userId },
        select: { id: true, status: true },
        orderBy: { id: "desc" },
        take: 5,
      }),
      prisma.agreement.findMany({
        where: { booking: { userId } },
        select: { id: true, status: true },
        orderBy: { id: "desc" },
        take: 10,
      }),
      prisma.invoice.findMany({
        where: { booking: { userId } },
        select: { id: true, number: true, amountPaise: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.ticket.findMany({
        where: { userId },
        select: { id: true, status: true },
        orderBy: { id: "desc" },
        take: 10,
      }),
      prisma.wallet.findUnique({ where: { userId } }),
      prisma.subscription.findMany({
        where: { booking: { userId }, status: { in: ["ACTIVE", "PAUSED"] } },
        select: { id: true, status: true, swapDueReason: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.carModel.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          images: { select: { url: true }, take: 1, orderBy: { sortOrder: "asc" } },
        },
      }),
    ]);
    const models = new Map(modelRows.map((m) => [m.id, m]));
    return {
      profile,
      bookings: bookings.map((b) => ({ ...b, carModel: models.get(b.carModelId) ?? null })),
      subscriptions,
      documents: { kycStatus: profile.kycStatus, kyc, agreements },
      invoices,
      tickets,
      wallet: wallet ?? { userId, balancePaise: 0 },
    };
  }

  async adminCustomer(id: string) {
    const profile = await this.me(id, { allowDisabled: true });
    const [bookings, kyc, agreements, invoices, tickets, notes, wallet] = await Promise.all([
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
      prisma.wallet.upsert({
        where: { userId: id },
        create: { userId: id, balancePaise: 0 },
        update: {},
        include: { txns: { orderBy: { createdAt: "desc" }, take: 20 } },
      }),
    ]);
    return {
      ...profile,
      bookings,
      documents: { kycStatus: profile.kycStatus, kyc, agreements },
      invoices,
      tickets,
      notes,
      wallet,
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
    await assertAuthMethod("otp");
    const email = emailRaw.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException("Valid email required");
    }
    await assertCanCreateViaOtp(email);
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
    await assertAuthMethod("otp");
    const email = emailRaw.toLowerCase().trim();
    await assertCanCreateViaOtp(email);
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

  private resetOtpKey(email: string) {
    return `reset:${email}`;
  }

  async issuePasswordReset(emailRaw: string) {
    await assertAuthMethod("password");
    const email = emailRaw.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException("Valid email required");
    }
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, status: true },
    });
    if (!user) throw new UnauthorizedException("No account found with this email");
    if (user.status === UserStatus.DISABLED) {
      throw new UnauthorizedException("Account disabled");
    }
    const key = this.resetOtpKey(email);
    const now = new Date();
    const existing = await this.loadOtp(key);
    let windowStart = existing ? new Date(existing.windowStart) : now;
    let windowCount = existing?.windowCount ?? 0;
    if (now.getTime() - windowStart.getTime() > OTP_WINDOW_MS) {
      windowStart = now;
      windowCount = 0;
    }
    if (windowCount >= OTP_MAX_SEND) {
      throw new BadRequestException("Too many reset requests. Try again in 15 minutes.");
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.saveOtp(key, {
      codeHash: hashOtp(key, code),
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      attempts: 0,
      windowStart,
      windowCount: windowCount + 1,
    });
    return code;
  }

  async resetPasswordWithOtp(emailRaw: string, code: string, password: string, ip?: string) {
    await assertAuthMethod("password");
    const email = emailRaw.toLowerCase().trim();
    if (!password || password.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters");
    }
    const key = this.resetOtpKey(email);
    const row = await this.loadOtp(key);
    if (!row || row.expiresAt < Date.now()) {
      throw new BadRequestException("Invalid or expired OTP");
    }
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      await this.clearOtp(key);
      throw new BadRequestException("Too many attempts. Request a new OTP.");
    }
    if (!hashesMatch(row.codeHash, hashOtp(key, code.trim()))) {
      await this.saveOtp(key, {
        codeHash: row.codeHash,
        expiresAt: new Date(row.expiresAt),
        attempts: row.attempts + 1,
        windowStart: new Date(row.windowStart),
        windowCount: row.windowCount,
      });
      throw new BadRequestException("Invalid or expired OTP");
    }
    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } }, profile: true, addresses: true, staffScopes: STAFF_SCOPE_INCLUDE },
    });
    if (!user) throw new UnauthorizedException("No account found with this email");
    if (user.status === UserStatus.DISABLED) {
      throw new UnauthorizedException("Account disabled");
    }
    await this.clearOtp(key);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password), issuedPassword: null },
      include: { roles: { include: { role: true } }, profile: true, addresses: true, staffScopes: STAFF_SCOPE_INCLUDE },
    });
    await invalidateUserProfile(updated.id);
    void this.audit({ actorId: updated.id, action: "auth.password-reset", entityId: updated.id, ip });
    return {
      token: mintSessionToken({ email: updated.email, uid: updated.firebaseUid }),
      user: this.present(updated),
    };
  }

  async loginStaffWithPassword(emailRaw: string, password: string, ip?: string) {
    const email = String(emailRaw || "").toLowerCase().trim();
    if (!email || !password) {
      throw new BadRequestException("email and password required");
    }
    await this.maybeBootstrapSuperAdmin(email, password);
    const row = await prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } }, profile: true, addresses: true, staffScopes: STAFF_SCOPE_INCLUDE },
    });
    if (!row) {
      throw new UnauthorizedException("Invalid email or password");
    }
    if (row.status === UserStatus.DISABLED) {
      throw new UnauthorizedException("Account disabled");
    }
    const roles = row.roles.map((r) => r.role.name);
    if (!roles.some((r) => STAFF_ROLES.includes(r))) {
      throw new ForbiddenException("This account is not staff");
    }
    if (!row.passwordHash || !(await verifyPassword(password, row.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }
    const user = this.present(row);
    void this.audit({ actorId: user.id, action: "auth.staff-login", entityId: user.id, ip });
    return {
      token: mintSessionToken({ email: user.email, uid: user.firebaseUid }),
      user,
    };
  }

  async setStaffPassword(actorId: string, userId: string, password: string, ip?: string) {
    if (!password || password.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters");
    }
    const target = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!target) throw new NotFoundException("User not found");
    const roles = target.roles.map((r) => r.role.name);
    if (!roles.some((r) => STAFF_ROLES.includes(r))) {
      throw new BadRequestException("Passwords can only be set on staff accounts");
    }
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(password), issuedPassword: password },
    });
    await invalidateUserProfile(userId);
    await this.audit({
      actorId,
      action: "user.password",
      entityId: userId,
      ip,
    });
    const fresh = await this.me(userId, { allowDisabled: true });
    return { ...fresh, issuedPassword: password };
  }

  async enable(actorId: string, userId: string, ip?: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
    });
    await invalidateUserProfile(userId);
    await this.audit({ actorId, action: "user.enable", entityId: userId, ip });
    return { id: user.id, status: user.status };
  }

  private async maybeBootstrapSuperAdmin(email: string, password: string) {
    if (email !== BOOTSTRAP_ADMIN_EMAIL || password !== BOOTSTRAP_ADMIN_PASSWORD) return;
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });
    if (existing?.passwordHash) return;
    const user = existing
      ? existing
      : await this.upsertFromIdentity({
          firebaseUid: `dev:${email}`,
          email,
          fullName: "Super Admin",
        });
    await this.ensureUserHasRole(user.id, "SUPER_ADMIN");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        issuedPassword: password,
        status: UserStatus.ACTIVE,
      },
    });
    await invalidateUserProfile(user.id);
  }

  async loginWithPassword(email: string, password: string, ip?: string) {
    const [settings, local] = await Promise.all([
      getAuthSettings(),
      this.tryLocalPasswordLogin(email, password, ip),
    ]);
    if (!settings.password) {
      throw new ForbiddenException("This sign-in method is currently disabled.");
    }
    if (local) return local;
    try {
      const fb = await firebaseSignInWithPassword(email, password);
      const user = await this.upsertFromIdentity({
        firebaseUid: fb.uid,
        email: fb.email,
        fullName: fb.name,
        ip,
      });
      void this.audit({ actorId: user.id, action: "auth.login", entityId: user.id, ip });
      return { token: fb.idToken, user };
    } catch (err) {
      const existing = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
        select: { id: true },
      });
      if (!existing) {
        throw new UnauthorizedException("EMAIL_NOT_FOUND");
      }
      throw err;
    }
  }

  private async tryLocalPasswordLogin(emailRaw: string, password: string, ip?: string) {
    const email = String(emailRaw || "").toLowerCase().trim();
    if (!email || !password) return null;
    const row = await prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } }, profile: true, addresses: true, staffScopes: STAFF_SCOPE_INCLUDE },
    });
    if (!row?.passwordHash) return null;
    if (row.status === UserStatus.DISABLED) {
      throw new UnauthorizedException("Account disabled");
    }
    const ok = await verifyPassword(password, row.passwordHash);
    if (!ok) return null;
    const user = this.present(row);
    void this.audit({ actorId: user.id, action: "auth.login", entityId: user.id, ip });
    return {
      token: mintSessionToken({ email: user.email, uid: user.firebaseUid }),
      user,
    };
  }

  private isPasswordCredentialFailure(err: unknown): boolean {
    if (!(err instanceof UnauthorizedException)) return false;
    const response = err.getResponse();
    const raw =
      typeof response === "string"
        ? response
        : Array.isArray((response as { message?: unknown }).message)
          ? (response as { message: string[] }).message.join(" ")
          : String((response as { message?: unknown }).message ?? err.message);
    return /INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND|INVALID_PASSWORD|Invalid credentials|auth\/user-not-found|auth\/wrong-password|auth\/invalid-credential/i.test(
      raw
    );
  }

  async registerWithPassword(
    email: string,
    password: string,
    fullName?: string,
    ip?: string,
    phoneRaw?: string
  ) {
    await assertAuthMethod("register");
    if (!password || password.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters");
    }
    let phone: string | undefined;
    if (phoneRaw != null && String(phoneRaw).trim() !== "") {
      phone = normalizePhone(phoneRaw);
      const taken = await prisma.user.findFirst({ where: { phone } });
      if (taken) {
        throw new BadRequestException("This mobile number is already registered");
      }
    }
    const fb = await firebaseSignUpWithPassword(email, password);
    const user = await this.upsertFromIdentity({
      firebaseUid: fb.uid,
      email: fb.email,
      fullName: fullName || fb.name,
      phone,
      ip,
    });
    await this.audit({ actorId: user.id, action: "auth.register", entityId: user.id, ip });
    return { token: fb.idToken, user };
  }

  async loginWithDevEmail(emailRaw: string, ip?: string) {
    if (!allowDevAuthBypass()) {
      throw new UnauthorizedException("Dev sign-in is disabled");
    }
    const email = String(emailRaw || "").toLowerCase().trim();
    if (!email) throw new BadRequestException("email required");
    const staffRole = DEV_STAFF[email];
    const user = await this.upsertFromIdentity({
      firebaseUid: `dev:${email}`,
      email,
      fullName: DEV_STAFF_NAMES[email] || email.split("@")[0],
      ip,
    });
    if (staffRole) {
      await this.ensureUserHasRole(user.id, staffRole);
    }
    await invalidateUserProfile(user.id);
    const fresh = await this.meUncached(user.id);
    await this.audit({ actorId: fresh.id, action: "auth.dev", entityId: fresh.id, ip });
    return { token: `dev:${email}`, user: fresh };
  }

  async loginWithGoogle(idToken: string, ip?: string) {
    await assertAuthMethod("google");
    const google = await verifyGoogleOrFirebaseIdToken(idToken);
    await assertCanCreateViaSocial(google.email);
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

  async loginWithFacebook(accessToken: string, ip?: string) {
    await assertAuthMethod("facebook");
    const fb = await verifyFacebookAccessToken(accessToken);
    await assertCanCreateViaSocial(fb.email);
    const user = await this.upsertFromIdentity({
      firebaseUid: fb.uid,
      email: fb.email,
      fullName: fb.name,
      ip,
    });
    await this.audit({ actorId: user.id, action: "auth.facebook", entityId: user.id, ip });
    return {
      token: mintSessionToken({ email: user.email, uid: user.firebaseUid }),
      user,
    };
  }

  async listUsers(
    actor: { roles: string[]; assignedCityId?: string | null },
    q?: string,
    take = 100,
    opts?: { staff?: boolean; customers?: boolean; role?: string }
  ) {
    const limit = Math.min(Math.max(Number(take) || 100, 1), 200);
    const term = q?.trim();
    const superAdmin = actor.roles.includes("SUPER_ADMIN");
    const cityId = actor.assignedCityId || null;
    const staffOnly = Boolean(opts?.staff);
    const customersOnly = Boolean(opts?.customers) && !staffOnly;
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
        ...(staffOnly
          ? { roles: { some: { role: { name: { in: STAFF_ROLES } } } } }
          : customersOnly
            ? { roles: { none: { role: { name: { in: STAFF_ROLES } } } } }
            : opts?.role
              ? { roles: { some: { role: { name: opts.role as RoleName } } } }
              : {}),
        ...(!superAdmin && staffOnly
          ? cityId
            ? { staffScopes: { some: { cityId } } }
            : { id: { in: [] } }
          : {}),
      },
      include: { roles: { include: { role: true } }, profile: true, staffScopes: STAFF_SCOPE_INCLUDE },
      orderBy: { createdAt: "desc" },
      take: limit,
    }).then((rows) =>
      rows.map((u) =>
        this.present(u, {
          includeIssuedPassword:
            staffOnly && (superAdmin || actor.roles.includes("CITY_MANAGER")),
        })
      )
    );
  }

  async staffProfile(
    id: string,
    actor: { id: string; roles: string[]; assignedCityId?: string | null }
  ) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } },
        profile: true,
        staffScopes: STAFF_SCOPE_INCLUDE,
      },
    });
    if (!user) throw new NotFoundException("Staff not found");
    const names = user.roles.map((r) => r.role.name);
    if (!names.some((r) => STAFF_ROLES.includes(r))) {
      throw new BadRequestException("This account is a customer, not staff");
    }
    const superAdmin = actor.roles.includes("SUPER_ADMIN");
    const isSelf = actor.id === id;
    if (!superAdmin && !isSelf) {
      if (!actor.roles.includes("CITY_MANAGER")) {
        throw new ForbiddenException("Staff profile is not available");
      }
      const cityId = actor.assignedCityId || null;
      const scopeCity = user.staffScopes?.[0]?.cityId || null;
      if (!cityId || (scopeCity && scopeCity !== cityId)) {
        throw new ForbiddenException("Staff is outside your city");
      }
    }
    const audits = await prisma.auditLog.findMany({
      where: { entityId: id, entity: "User" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { actor: { select: { email: true } } },
    });
    return {
      ...this.present(user, {
        includeIssuedPassword: superAdmin || actor.roles.includes("CITY_MANAGER"),
      }),
      audits,
    };
  }

  async updateStaffHr(
    actorId: string,
    userId: string,
    input: { phone?: string | null; salaryInr?: number | null },
    ip?: string
  ) {
    const actor = await this.me(actorId);
    if (!actor.roles.includes("SUPER_ADMIN")) {
      throw new ForbiddenException("Only super admin can edit phone and salary");
    }
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!existing) throw new NotFoundException("Staff not found");
    if (!existing.roles.some((r) => STAFF_ROLES.includes(r.role.name))) {
      throw new BadRequestException("This account is a customer, not staff");
    }
    const data: { phone?: string | null; salaryInr?: number | null } = {};
    if (input.phone !== undefined) {
      data.phone =
        input.phone == null || String(input.phone).trim() === ""
          ? null
          : await this.uniqueStaffPhone(String(input.phone), userId);
    }
    if (input.salaryInr !== undefined) {
      data.salaryInr = this.parseSalary(input.salaryInr);
    }
    if (!Object.keys(data).length) {
      throw new BadRequestException("Nothing to update");
    }
    await prisma.user.update({ where: { id: userId }, data });
    await invalidateUserProfile(userId);
    await this.audit({
      actorId,
      action: "staff.hr",
      entityId: userId,
      payload: data,
      ip,
    });
    return this.staffProfile(userId, { id: actor.id, roles: actor.roles, assignedCityId: actor.cityId });
  }

  private parseSalary(value: number | string | null | undefined) {
    if (value == null || String(value).trim() === "") return null;
    const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000) {
      throw new BadRequestException("Enter a valid monthly salary");
    }
    return Math.round(n);
  }

  private async uniqueStaffPhone(raw: string, userId: string) {
    const phone = normalizePhone(raw);
    const taken = await prisma.user.findFirst({
      where: { phone, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) throw new BadRequestException("That phone number is already in use");
    return phone;
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
    await invalidateUserProfile(userId);
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
      password?: string;
      generatePassword?: boolean;
      roles?: RoleName[];
      cityId?: string;
      branchId?: string;
      phone?: string;
      salaryInr?: number | null;
    },
    ip?: string
  ) {
    const actor = await this.me(actorId);
    const email = input.email.toLowerCase().trim();
    const password =
      input.password ||
      (input.generatePassword ? generateStaffPassword() : undefined);
    if (password != null && password.length > 0 && password.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters");
    }
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
    const needsLocation = roles.some((r) => r !== "SUPER_ADMIN");
    if (needsLocation && !cityId) {
      throw new BadRequestException("Pick a city so this staff member has a location in their panel");
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing && !password) {
      throw new BadRequestException("Password is required for new staff");
    }
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
    if (password) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(password), issuedPassword: password },
      });
    }
    const hr: { phone?: string | null; salaryInr?: number | null } = {};
    if (actorIsSuper) {
      if (input.phone !== undefined) {
        if (input.phone == null || String(input.phone).trim() === "") hr.phone = null;
        else hr.phone = await this.uniqueStaffPhone(String(input.phone), user.id);
      }
      if (input.salaryInr !== undefined) hr.salaryInr = this.parseSalary(input.salaryInr);
    }
    if (Object.keys(hr).length) {
      await prisma.user.update({ where: { id: user.id }, data: hr });
    }
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
    await invalidateUserProfile(user.id);
    await this.audit({
      actorId,
      action: "user.invite",
      entityId: user.id,
      payload: { email, roles, cityId, branchId },
      ip,
    });
    const fresh = await this.me(user.id);
    return { ...fresh, issuedPassword: password || null };
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
    await invalidateUserProfile(userId);
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
    await invalidateUserProfile(userId);
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
    await invalidateUserProfile(userId);
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

  private async ensureUserHasRole(userId: string, name: RoleName) {
    const role = await this.ensureRole(name);
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      create: { userId, roleId: role.id },
      update: {},
    });
  }

  private present(user: {
    id: string;
    firebaseUid: string;
    email: string;
    phone: string | null;
    passwordHash?: string | null;
    issuedPassword?: string | null;
    salaryInr?: number | null;
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
    staffScopes?: {
      cityId: string | null;
      branchId: string | null;
      city?: { name: string } | null;
      branch?: { name: string } | null;
    }[];
  }, opts: { includeIssuedPassword?: boolean } = {}) {
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
      salaryInr: user.salaryInr ?? null,
      pendingPhone: user.profile?.pendingPhone ?? pendingPhones.get(user.id) ?? null,
      status: user.status,
      createdAt: user.createdAt,
      fullName: user.profile?.fullName ?? null,
      kycStatus,
      kycValidUntil: user.profile?.kycValidUntil ?? null,
      nameLocked: kycStatus === "APPROVED",
      roles,
      passwordSet: Boolean(user.passwordHash),
      ...(opts.includeIssuedPassword ? { issuedPassword: user.issuedPassword || null } : {}),
      cityId: scope?.cityId ?? null,
      branchId: scope?.branchId ?? null,
      cityName: scope?.city?.name ?? null,
      branchName: scope?.branch?.name ?? null,
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
