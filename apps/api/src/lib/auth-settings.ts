import { BadRequestException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { prisma } from "./prisma";
import { cacheDel, remember } from "./cache";

export type AuthMethod = "password" | "otp" | "register" | "google" | "facebook";

export type AuthSettings = {
  password: boolean;
  otp: boolean;
  register: boolean;
  google: boolean;
  facebook: boolean;
  otpCreatesAccount: boolean;
  socialCreatesAccount: boolean;
};

export const AUTH_SETTINGS_CACHE_KEY = "dd:auth-settings";

export const AUTH_SETTING_DEFAULTS: Record<
  string,
  { label: string; group: string; value: string; hint: string }
> = {
  "auth.password": {
    label: "Email + password",
    group: "auth",
    value: "true",
    hint: "Keep on. Returning customers who already set a password.",
  },
  "auth.otp": {
    label: "Email OTP",
    group: "auth",
    value: "true",
    hint: "Keep on. Fast passwordless login — a 6-digit code to email.",
  },
  "auth.register": {
    label: "Create account (email + password)",
    group: "auth",
    value: "true",
    hint: "Keep on so new customers can sign up without Google/Facebook.",
  },
  "auth.google": {
    label: "Continue with Google",
    group: "auth",
    value: "true",
    hint: "Keep on. Highest conversion for new users in India.",
  },
  "auth.facebook": {
    label: "Continue with Facebook",
    group: "auth",
    value: "false",
    hint: "Leave off unless a Facebook app is configured. Usage is low.",
  },
  "auth.otpCreatesAccount": {
    label: "OTP can create new accounts",
    group: "auth",
    value: "true",
    hint: "On: first OTP signs them up. Off: OTP is login-only for existing emails.",
  },
  "auth.socialCreatesAccount": {
    label: "Google / Facebook can create new accounts",
    group: "auth",
    value: "true",
    hint: "On: first social login creates the customer. Off: social is login-only.",
  },
};

const DEFAULTS: AuthSettings = {
  password: true,
  otp: true,
  register: true,
  google: true,
  facebook: false,
  otpCreatesAccount: true,
  socialCreatesAccount: true,
};

function isOn(value: string | undefined, fallback: boolean) {
  if (value == null || value === "") return fallback;
  return value === "true" || value === "1" || value === "on";
}

export async function getAuthSettings(): Promise<AuthSettings> {
  return remember(AUTH_SETTINGS_CACHE_KEY, 15, async () => {
    const keys = Object.keys(AUTH_SETTING_DEFAULTS);
    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: keys } },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      password: isOn(map["auth.password"], DEFAULTS.password),
      otp: isOn(map["auth.otp"], DEFAULTS.otp),
      register: isOn(map["auth.register"], DEFAULTS.register),
      google: isOn(map["auth.google"], DEFAULTS.google),
      facebook: isOn(map["auth.facebook"], DEFAULTS.facebook),
      otpCreatesAccount: isOn(map["auth.otpCreatesAccount"], DEFAULTS.otpCreatesAccount),
      socialCreatesAccount: isOn(
        map["auth.socialCreatesAccount"],
        DEFAULTS.socialCreatesAccount
      ),
    };
  });
}

export async function invalidateAuthSettingsCache() {
  await cacheDel(AUTH_SETTINGS_CACHE_KEY, "dd:home");
}

export function assertAtLeastOneSignIn(settings: Partial<AuthSettings>) {
  const password = settings.password ?? DEFAULTS.password;
  const otp = settings.otp ?? DEFAULTS.otp;
  const google = settings.google ?? DEFAULTS.google;
  const facebook = settings.facebook ?? DEFAULTS.facebook;
  if (!password && !otp && !google && !facebook) {
    throw new BadRequestException(
      "Keep at least one customer sign-in method on (password, OTP, Google, or Facebook)."
    );
  }
}

export async function assertAuthMethod(method: AuthMethod) {
  const settings = await getAuthSettings();
  if (!settings[method]) {
    throw new ForbiddenException(
      method === "register"
        ? "New account sign-up is currently disabled."
        : "This sign-in method is currently disabled."
    );
  }
  return settings;
}

export async function assertCanCreateViaOtp(email: string) {
  const settings = await getAuthSettings();
  if (!settings.otp) {
    throw new ForbiddenException("This sign-in method is currently disabled.");
  }
  if (settings.otpCreatesAccount) return settings;
  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true },
  });
  if (!existing) {
    throw new UnauthorizedException("No account found with this email");
  }
  return settings;
}

export async function assertCanCreateViaSocial(email?: string) {
  const settings = await getAuthSettings();
  if (settings.socialCreatesAccount) return settings;
  if (!email) {
    throw new UnauthorizedException("No account found for this social login");
  }
  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true },
  });
  if (!existing) {
    throw new UnauthorizedException("No account found. Sign-up is currently closed.");
  }
  return settings;
}
