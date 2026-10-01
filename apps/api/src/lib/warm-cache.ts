import { prisma } from "./prisma";
import { pingRedis, remember } from "./cache";

export async function warmPublicCache() {
  const redis = await pingRedis();
  try {
    await Promise.all([
      remember("dd:cities", 180, () =>
        prisma.city.findMany({
          where: { active: true },
          include: { branches: { where: { active: true } } },
          orderBy: { name: "asc" },
        })
      ),
      remember("dd:settings", 180, () =>
        prisma.catalogSettings.upsert({
          where: { id: "default" },
          create: {
            id: "default",
            bufferHours: Number(process.env.BUFFER_HOURS ?? 3),
            maxRentalDays: Number(process.env.MAX_RENTAL_DAYS ?? 30),
          },
          update: {},
        })
      ),
    ]);
    console.log(`cache warm: cities + settings (${redis ? "redis" : "memory"})`);
  } catch (err) {
    console.warn("cache warm failed:", err instanceof Error ? err.message : err);
  }
}
