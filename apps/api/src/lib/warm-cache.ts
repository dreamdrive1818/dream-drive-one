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
      remember("dd:settings", 180, async () => {
        const existing = await prisma.catalogSettings.findUnique({ where: { id: "default" } });
        if (existing) return existing;
        return prisma.catalogSettings.create({
          data: {
            id: "default",
            bufferHours: Number(process.env.BUFFER_HOURS ?? 3),
            maxRentalDays: Number(process.env.MAX_RENTAL_DAYS ?? 30),
          },
        });
      }),
    ]);
    console.log(`cache warm: cities + settings (${redis ? "redis" : "memory"})`);
  } catch (err) {
    console.warn("cache warm failed:", err instanceof Error ? err.message : err);
  }
}
