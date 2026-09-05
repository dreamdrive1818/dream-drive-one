import type { CommissionRule, RentalType } from "@prisma/client";
import { prisma } from "./prisma";

export type BankDetails = {
  accountName?: string;
  accountNumber?: string;
  ifsc?: string;
  bankName?: string;
  branchName?: string;
  upi?: string;
};

export function parseBank(raw: unknown): BankDetails {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const str = (k: string) => (o[k] != null ? String(o[k]).trim() : "");
  return {
    accountName: str("accountName") || undefined,
    accountNumber: str("accountNumber") || undefined,
    ifsc: str("ifsc")?.toUpperCase() || undefined,
    bankName: str("bankName") || undefined,
    branchName: str("branchName") || undefined,
    upi: str("upi") || undefined,
  };
}

export function hasPayoutBank(raw: unknown): boolean {
  const bank = parseBank(raw);
  return Boolean(bank.accountName && bank.accountNumber && bank.ifsc);
}

export function pickCommissionRule(rules: CommissionRule[], rentalType: RentalType) {
  return rules.find((r) => r.rentalType === rentalType) ?? rules.find((r) => r.rentalType == null) ?? null;
}

export function computeCommissionPaise(amountPaise: number, percentBps: number, flatPaise: number) {
  return Math.max(0, Math.round((amountPaise * percentBps) / 10000) + (flatPaise || 0));
}

export async function freezeBookingCommission(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { vehicle: { select: { partnerId: true } } },
  });
  if (!booking) return null;
  const partnerId = booking.vehicle?.partnerId;
  if (!partnerId) {
    if (booking.commissionPercentBps != null || booking.commissionFlatPaise != null) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { commissionPercentBps: null, commissionFlatPaise: null },
      });
    }
    return { partnerId: null, percentBps: null, flatPaise: null };
  }
  const rules = await prisma.commissionRule.findMany({ where: { partnerId } });
  const rule = pickCommissionRule(rules, booking.rentalType);
  const percentBps = rule?.percentBps ?? 0;
  const flatPaise = rule?.flatPaise ?? 0;
  await prisma.booking.update({
    where: { id: bookingId },
    data: { commissionPercentBps: percentBps, commissionFlatPaise: flatPaise },
  });
  return { partnerId, percentBps, flatPaise };
}
