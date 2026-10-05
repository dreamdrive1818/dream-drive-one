import { prisma } from "./prisma";

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS "CarModel_published_cityId_idx" ON "CarModel" ("published", "cityId")`,
  `CREATE INDEX IF NOT EXISTS "CarModel_published_featured_displayOrder_idx" ON "CarModel" ("published", "featured", "displayOrder")`,
  `CREATE INDEX IF NOT EXISTS "CarImage_carModelId_sortOrder_idx" ON "CarImage" ("carModelId", "sortOrder")`,
  `CREATE INDEX IF NOT EXISTS "PricingRule_carModelId_rentalType_idx" ON "PricingRule" ("carModelId", "rentalType")`,
  `CREATE INDEX IF NOT EXISTS "Booking_carModelId_status_idx" ON "Booking" ("carModelId", "status")`,
  `CREATE INDEX IF NOT EXISTS "Booking_vehicleId_status_startsAt_idx" ON "Booking" ("vehicleId", "status", "startsAt")`,
  `CREATE INDEX IF NOT EXISTS "Booking_status_startsAt_endsAt_idx" ON "Booking" ("status", "startsAt", "endsAt")`,
  `CREATE INDEX IF NOT EXISTS "Vehicle_carModelId_status_idx" ON "Vehicle" ("carModelId", "status")`,
  `CREATE INDEX IF NOT EXISTS "AvailabilityBlock_vehicleId_startsAt_endsAt_idx" ON "AvailabilityBlock" ("vehicleId", "startsAt", "endsAt")`,
  `CREATE INDEX IF NOT EXISTS "MaintenanceJob_vehicleId_status_idx" ON "MaintenanceJob" ("vehicleId", "status")`,
];

export async function ensurePublicIndexes() {
  for (const sql of INDEXES) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (err) {
      console.warn("index skipped:", err instanceof Error ? err.message : err);
    }
  }
}
