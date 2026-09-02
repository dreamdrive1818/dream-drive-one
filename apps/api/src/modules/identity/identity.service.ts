import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { RoleName, UserStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { firebaseSignInWithPassword } from "../../lib/firebase-rest";

const otpStore = new Map<string, { code: string; expiresAt: number }>();

@Injectable()
export class IdentityService {
  async upsertFromIdentity(input: {
    firebaseUid: string;
    email: string;
    phone?: string | null;
    fullName?: string;
  }) {
    const email = input.email.toLowerCase().trim();
    const existing = await prisma.user.findFirst({
      where: { OR: [{ firebaseUid: input.firebaseUid }, { email }] },
      include: { roles: { include: { role: true } }, profile: true },
    });

    if (existing) {
      const user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          firebaseUid: input.firebaseUid,
          email,
          phone: input.phone ?? existing.phone,
        },
        include: { roles: { include: { role: true } }, profile: true },
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
      include: { roles: { include: { role: true } }, profile: true },
    });
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "auth.sync",
        entity: "User",
        entityId: user.id,
      },
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

  issueOtp(email: string) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(email.toLowerCase(), {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    return code;
  }

  async loginWithPassword(email: string, password: string) {
    const fb = await firebaseSignInWithPassword(email, password);
    const user = await this.upsertFromIdentity({
      firebaseUid: fb.uid,
      email: fb.email,
      fullName: fb.name,
    });
    if (user.status === UserStatus.DISABLED) {
      throw new UnauthorizedException("Account disabled");
    }
    return { token: fb.idToken, user };
  }

  verifyOtp(email: string, code: string) {
    const row = otpStore.get(email.toLowerCase());
    if (!row || row.expiresAt < Date.now() || row.code !== code) {
      throw new BadRequestException("Invalid or expired OTP");
    }
    otpStore.delete(email.toLowerCase());
    return { ok: true };
  }

  async listUsers(q?: string) {
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
      include: { roles: { include: { role: true } }, profile: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }).then((rows) => rows.map((u) => this.present(u)));
  }

  async setRoles(actorId: string, userId: string, roles: RoleName[]) {
    if (!roles.length) throw new BadRequestException("At least one role required");
    const unique = [...new Set(roles)];
    if (!unique.includes("SUPER_ADMIN")) {
      const target = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } },
      });
      const wasSuper = target?.roles.some((r) => r.role.name === "SUPER_ADMIN");
      if (wasSuper) {
        const supers = await prisma.userRole.count({
          where: { role: { name: "SUPER_ADMIN" } },
        });
        if (supers <= 1) {
          throw new BadRequestException("Cannot remove the last super admin");
        }
      }
    }
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
    await prisma.auditLog.create({
      data: {
        actorId,
        action: "user.roles",
        entity: "User",
        entityId: userId,
        payload: { roles: unique },
      },
    });
    return this.me(userId);
  }

  async disable(actorId: string, userId: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.DISABLED },
    });
    await prisma.auditLog.create({
      data: { actorId, action: "user.disable", entity: "User", entityId: userId },
    });
    return { id: user.id, status: user.status };
  }

  async audit(take = 100) {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take,
      include: { actor: { select: { email: true } } },
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
