import {
  BadRequestException,
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

  async me(userId: string) {
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
    if (user.status === UserStatus.DISABLED) {
      throw new UnauthorizedException("Account disabled");
    }
    return this.present(user);
  }

  async patchMe(
    userId: string,
    body: { fullName?: string; phone?: string; address?: Record<string, string> }
  ) {
    if (body.phone) {
      const taken = await prisma.user.findFirst({
        where: { phone: body.phone, NOT: { id: userId } },
      });
      if (taken) throw new BadRequestException("Phone already in use");
    }
    await prisma.user.update({
      where: { id: userId },
      data: {
        phone: body.phone,
        profile: body.fullName
          ? { upsert: { create: { fullName: body.fullName }, update: { fullName: body.fullName } } }
          : undefined,
      },
    });
    if (body.address?.line1) {
      await prisma.address.create({
        data: {
          userId,
          line1: body.address.line1,
          line2: body.address.line2,
          city: body.address.city ?? "",
          state: body.address.state ?? "",
          zip: body.address.zip ?? "",
          isDefault: true,
        },
      });
    }
    return this.me(userId);
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

  async listUsers(q?: string, take = 100) {
    const limit = Math.min(Math.max(Number(take) || 100, 1), 200);
    return prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { profile: { fullName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : undefined,
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
    const email = input.email.toLowerCase().trim();
    const roles = [...new Set(input.roles?.length ? input.roles : (["SUPPORT"] as RoleName[]))];
    if (!roles.some((r) => STAFF_ROLES.includes(r))) {
      throw new BadRequestException("Invite requires a staff role");
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
    if (input.cityId || input.branchId) {
      await prisma.staffScope.deleteMany({ where: { userId: user.id } });
      await prisma.staffScope.create({
        data: {
          userId: user.id,
          cityId: input.cityId,
          branchId: input.branchId,
        },
      });
    }
    await this.audit({
      actorId,
      action: "user.invite",
      entityId: user.id,
      payload: { email, roles },
      ip,
    });
    return this.me(user.id);
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
    profile?: { fullName: string; kycStatus: string } | null;
    addresses?: unknown;
    staffScopes?: { cityId: string | null; branchId: string | null }[];
  }) {
    const roles = user.roles.map((r) => r.role.name);
    const scope = user.staffScopes?.[0];
    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      phone: user.phone,
      status: user.status,
      createdAt: user.createdAt,
      fullName: user.profile?.fullName ?? null,
      kycStatus: user.profile?.kycStatus ?? "NOT_STARTED",
      roles,
      cityId: scope?.cityId ?? null,
      branchId: scope?.branchId ?? null,
      addresses: user.addresses,
    };
  }
}
