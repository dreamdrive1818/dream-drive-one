import { prisma } from "./prisma";

/** ₹1 spent → 1 loyalty point (amountPaise / 100). */
export function pointsForBooking(amountPaise: number) {
  return Math.max(0, Math.floor(amountPaise / 100));
}

/** Flat referral wallet credit after referee's first COMPLETED booking. */
export const REFERRAL_CREDIT_PAISE = 20_000;

/**
 * Earn loyalty points and (once) pay referral credit when a booking becomes COMPLETED.
 * Safe to call more than once — loyalty is keyed by bookingId; referral by creditedAt.
 */
export async function onBookingCompleted(bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status !== "COMPLETED") return { skipped: true };

  const points = pointsForBooking(booking.amountPaise);
  if (points > 0) {
    const account = await prisma.loyaltyAccount.upsert({
      where: { userId: booking.userId },
      create: { userId: booking.userId, points: 0 },
      update: {},
    });
    const already = await prisma.loyaltyTxn.findFirst({
      where: { accountId: account.id, bookingId: booking.id },
    });
    if (!already) {
      await prisma.$transaction([
        prisma.loyaltyTxn.create({
          data: {
            accountId: account.id,
            points,
            reason: `Trip ${booking.publicId} completed`,
            bookingId: booking.id,
          },
        }),
        prisma.loyaltyAccount.update({
          where: { id: account.id },
          data: { points: { increment: points } },
        }),
      ]);
    }
  }

  const referral = await prisma.referral.findFirst({
    where: { refereeId: booking.userId, creditedAt: null },
  });
  if (!referral) return { loyaltyPoints: points, referral: null };

  const priorCompleted = await prisma.booking.count({
    where: {
      userId: booking.userId,
      status: "COMPLETED",
      id: { not: booking.id },
    },
  });
  if (priorCompleted > 0) return { loyaltyPoints: points, referral: "not_first" };

  const wallet = await prisma.wallet.upsert({
    where: { userId: referral.referrerId },
    create: { userId: referral.referrerId, balancePaise: 0 },
    update: {},
  });

  await prisma.$transaction([
    prisma.wallet.update({
      where: { id: wallet.id },
      data: { balancePaise: { increment: REFERRAL_CREDIT_PAISE } },
    }),
    prisma.walletTxn.create({
      data: {
        walletId: wallet.id,
        amountPaise: REFERRAL_CREDIT_PAISE,
        reason: `Referral credit — ${booking.publicId}`,
      },
    }),
    prisma.referral.update({
      where: { id: referral.id },
      data: { creditedAt: new Date(), creditPaise: REFERRAL_CREDIT_PAISE },
    }),
  ]);

  return { loyaltyPoints: points, referral: referral.code, creditPaise: REFERRAL_CREDIT_PAISE };
}
