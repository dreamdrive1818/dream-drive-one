import { prisma } from "./prisma";
import { pingRedis, remember } from "./cache";
import { ensurePublicIndexes } from "./db-indexes";
import { syncMailTemplates } from "../modules/notification/notify.service";
import { getAuthSettings } from "./auth-settings";

let primed = false;

export async function warmPublicCache() {
  const redis = await pingRedis();
  const first = !primed;
  primed = true;
  try {
    await Promise.all([
      ...(first
        ? [
            ensurePublicIndexes(),
            syncMailTemplates().catch((err) => {
              console.warn("mail templates:", err instanceof Error ? err.message : err);
            }),
          ]
        : []),
      getAuthSettings(),
      remember("dd:cities", 600, () =>
        prisma.city.findMany({
          where: { active: true },
          include: { branches: { where: { active: true } } },
          orderBy: { name: "asc" },
        })
      ),
      remember("dd:settings", 600, async () => {
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
