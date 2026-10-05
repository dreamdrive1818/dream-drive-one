import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BookingStatus, Prisma, RentalType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { addHours, daysBetween } from "../../lib/http";
import {
  availabilityCacheKey,
  carCacheKey,
  invalidateCatalogCache,
  remember,
  searchCacheKey,
} from "../../lib/cache";

const BLOCKING: BookingStatus[] = [
  "HOLD",
  "AWAITING_PAYMENT",
  "AWAITING_KYC",
  "AWAITING_SIGNATURE",
  "CONFIRMED",
  "HANDOVER",
  "ONGOING",
  "RETURN_PENDING",
];

const MAX_DAYS_BY_TYPE: Record<RentalType, number> = {
  SELF_DRIVE: 30,
  WITH_DRIVER_LOCAL: 7,
  WITH_DRIVER_INTERCITY: 15,
  AIRPORT: 2,
  OUTSTATION: 15,
  ONE_WAY: 5,
  TOUR_PACKAGE: 21,
  SUBSCRIPTION: 365,
};

type Db = Prisma.TransactionClient | typeof prisma;

type PriceRow = {
  rentalType: RentalType;
  dailyPaise: number;
  under12Paise?: number | null;
  extraKmPaise: number | null;
  depositPaise: number;
  hourlyPaise: number | null;
  startsOn: Date | null;
  endsOn: Date | null;
};

const RENTAL_TYPES = new Set<string>(Object.keys(MAX_DAYS_BY_TYPE));

@Injectable()
export class CatalogService {
  async getSettings() {
    const fallback = {
      id: "default",
      bufferHours: Number(process.env.BUFFER_HOURS ?? 3),
      maxRentalDays: Number(process.env.MAX_RENTAL_DAYS ?? 30),
      driverAllowancePerNightPaise: 30000,
      updatedAt: new Date(),
    };
    try {
      return await remember("dd:settings", 600, async () => {
        const existing = await prisma.catalogSettings.findUnique({ where: { id: "default" } });
        if (existing) return existing;
        return prisma.catalogSettings.create({
          data: {
            id: "default",
            bufferHours: fallback.bufferHours,
            maxRentalDays: fallback.maxRentalDays,
          },
        });
      });
    } catch {
      return fallback;
    }
  }

  async bufferHours() {
    const settings = await this.getSettings();
    return settings.bufferHours;
  }

  async publicConfig() {
    return remember("dd:catcfg", 300, async () => {
      const settings = await this.getSettings();
      return {
        bufferHours: settings.bufferHours,
        maxRentalDays: settings.maxRentalDays,
        driverAllowancePerNightPaise: settings.driverAllowancePerNightPaise ?? 30000,
        maxDaysByType: MAX_DAYS_BY_TYPE,
      };
    });
  }

  async updateSettings(body: {
    bufferHours?: number;
    maxRentalDays?: number;
    driverAllowancePerNightPaise?: number;
  }) {
    const bufferHours =
      body.bufferHours != null ? Number(body.bufferHours) : undefined;
    const maxRentalDays =
      body.maxRentalDays != null ? Number(body.maxRentalDays) : undefined;
    const driverAllowancePerNightPaise =
      body.driverAllowancePerNightPaise != null
        ? Number(body.driverAllowancePerNightPaise)
        : undefined;
    if (bufferHours != null && (!Number.isFinite(bufferHours) || bufferHours < 0 || bufferHours > 72)) {
      throw new BadRequestException("bufferHours must be between 0 and 72");
    }
    if (maxRentalDays != null && (!Number.isFinite(maxRentalDays) || maxRentalDays < 1 || maxRentalDays > 365)) {
      throw new BadRequestException("maxRentalDays must be between 1 and 365");
    }
    if (
      driverAllowancePerNightPaise != null &&
      (!Number.isFinite(driverAllowancePerNightPaise) || driverAllowancePerNightPaise < 0)
    ) {
      throw new BadRequestException("driverAllowancePerNightPaise must be >= 0");
    }
    const settings = await prisma.catalogSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        bufferHours: bufferHours ?? 3,
        maxRentalDays: maxRentalDays ?? 30,
        driverAllowancePerNightPaise: driverAllowancePerNightPaise ?? 30000,
      },
      update: {
        bufferHours,
        maxRentalDays,
        driverAllowancePerNightPaise,
      },
    });
    await invalidateCatalogCache();
    return settings;
  }

  parseRange(from?: string, to?: string, rentalType?: RentalType) {
    if (!from && !to) return { from: null as Date | null, to: null as Date | null };
    if (!from || !to) throw new BadRequestException("from and to are both required");
    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException("Enter valid pickup and return dates");
    }
    if (!(start < end)) throw new BadRequestException("from must be before to");
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (start < startOfToday) throw new BadRequestException("Cannot search past dates");
    return { from: start, to: end, rentalType };
  }

  async assertRentalLength(from: Date, to: Date, rentalType: RentalType) {
    const settings = await this.getSettings();
    const typeCap = MAX_DAYS_BY_TYPE[rentalType] ?? settings.maxRentalDays;
    const cap = Math.min(typeCap, settings.maxRentalDays);
    const days = daysBetween(from, to);
    if (days > cap) {
      throw new BadRequestException(`Maximum rental length is ${cap} days for this product`);
    }
  }

  async search(query: {
    cityId?: string;
    from?: string;
    to?: string;
    rentalType?: RentalType;
    type?: string;
    seats?: string;
    fuel?: string;
    transmission?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
  }) {
    const rentalType = this.normalizeRentalType(query.rentalType);
    const { from, to } = this.parseRange(query.from, query.to, rentalType);
    if (from && to) await this.assertRentalLength(from, to, rentalType);

    return remember(searchCacheKey({ ...query, rentalType }), from && to ? 90 : 300, () =>
      this.searchUncached(query, rentalType, from, to)
    );
  }

  private async searchUncached(
    query: {
      cityId?: string;
      type?: string;
      seats?: string;
      fuel?: string;
      transmission?: string;
      minPrice?: string;
      maxPrice?: string;
      sort?: string;
    },
    rentalType: RentalType,
    from: Date | null,
    to: Date | null
  ) {
    const models = await prisma.carModel.findMany({
      where: {
        published: true,
        cityId: query.cityId || undefined,
        type: query.type
          ? { equals: query.type, mode: "insensitive" }
          : undefined,
        seats: query.seats ? Number(query.seats) : undefined,
        fuel: query.fuel
          ? { equals: query.fuel, mode: "insensitive" }
          : undefined,
        transmission: query.transmission
          ? { equals: query.transmission, mode: "insensitive" }
          : undefined,
      },
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 3, select: { url: true, sortOrder: true } },
        pricingRules: {
          select: {
            rentalType: true,
            dailyPaise: true,
            under12Paise: true,
            extraKmPaise: true,
            depositPaise: true,
            hourlyPaise: true,
            startsOn: true,
            endsOn: true,
          },
        },
        city: { select: { id: true, name: true, slug: true } },
      },
      orderBy: [{ featured: "desc" }, { displayOrder: "asc" }],
    });

    const ids = models.map((m) => m.id);
    const needPopularity = query.sort === "popularity";
    const [counts, avail] = await Promise.all([
      needPopularity && ids.length
        ? prisma.booking.groupBy({
            by: ["carModelId"],
            where: {
              carModelId: { in: ids },
              status: { notIn: ["DRAFT", "CANCELLED"] },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      from && to && ids.length
        ? this.batchAvailability(
            models.map((m) => ({ id: m.id, cityId: m.cityId })),
            from,
            to
          )
        : Promise.resolve(null),
    ]);
    const popularity = new Map(counts.map((c) => [c.carModelId, c._count._all]));

    const results = [];
    for (const model of models) {
      const rule = this.pickRule(model.pricingRules, rentalType, from);
      if (!rule) continue;
      if (query.minPrice && rule.dailyPaise < Number(query.minPrice)) continue;
      if (query.maxPrice && rule.dailyPaise > Number(query.maxPrice)) continue;
      const slot = avail?.get(model.id);
      const available = slot ? slot.available : true;
      const vehicleId = slot?.vehicleId ?? null;
      const availableCount = slot?.availableCount ?? null;
      results.push({
        id: model.id,
        slug: model.slug,
        name: model.name,
        type: model.type,
        seats: model.seats,
        fuel: model.fuel,
        transmission: model.transmission,
        featured: model.featured,
        city: model.city,
        images: model.images,
        pricePaise: rule.dailyPaise,
        extraKmPaise: rule.extraKmPaise,
        depositPaise: rule.depositPaise,
        seasonal: Boolean(rule.startsOn || rule.endsOn),
        available,
        vehicleId,
        availableCount: availableCount ?? null,
        bookingCount: popularity.get(model.id) ?? 0,
      });
    }

    return this.sortResults(results, query.sort);
  }

  sortResults<T extends { featured?: boolean; pricePaise?: number; bookingCount?: number }>(
    results: T[],
    sort?: string
  ) {
    const list = [...results];
    if (sort === "price-asc") list.sort((a, b) => (a.pricePaise ?? 0) - (b.pricePaise ?? 0));
    else if (sort === "price-desc") list.sort((a, b) => (b.pricePaise ?? 0) - (a.pricePaise ?? 0));
    else if (sort === "popularity") {
      list.sort((a, b) => (b.bookingCount ?? 0) - (a.bookingCount ?? 0));
    }
    return list;
  }

  async bySlug(slug: string) {
    return remember(carCacheKey(slug), 180, async () => {
      const model = await prisma.carModel.findUnique({
        where: { slug },
        include: { images: { orderBy: { sortOrder: "asc" } }, pricingRules: true, city: true },
      });
      if (!model || !model.published) throw new NotFoundException("Car not found");
      const settings = await this.getSettings();
      return {
        ...model,
        bufferHours: settings.bufferHours,
        maxRentalDays: settings.maxRentalDays,
        maxDaysByType: MAX_DAYS_BY_TYPE,
      };
    });
  }

  async availability(id: string, from?: string, to?: string, month?: string) {
    if (from || to) {
      const range = this.parseRange(from, to);
      await this.assertRentalLength(range.from!, range.to!, "SELF_DRIVE");
    }
    return remember(availabilityCacheKey(id, from, to, month), 45, () =>
      this.availabilityUncached(id, from, to, month)
    );
  }

  private async availabilityUncached(id: string, from?: string, to?: string, month?: string) {
    const model = await prisma.carModel.findUnique({
      where: { id },
      include: { pricingRules: true },
    });
    if (!model || !model.published) throw new NotFoundException("Car not found");

    const settings = await this.getSettings();
    const buffer = settings.bufferHours;
    let available: boolean | null = null;
    let vehicleId: string | null = null;

    if (from || to) {
      const range = this.parseRange(from, to);
      const vehicle = await this.findFreeVehicle(id, range.from!, range.to!, model.cityId);
      available = Boolean(vehicle);
      vehicleId = vehicle?.id ?? null;
    }

    const cal = this.monthBounds(month, from);
    const busyDays = await this.busyDaysForModel(id, model.cityId, cal.start, cal.end, buffer);

    return {
      available,
      vehicleId,
      bufferHours: buffer,
      maxRentalDays: settings.maxRentalDays,
      month: cal.key,
      busyDays,
    };
  }

  private async batchAvailability(
    models: { id: string; cityId: string }[],
    from: Date,
    to: Date
  ) {
    const result = new Map<string, { available: boolean; vehicleId: string | null; availableCount: number }>();
    if (!models.length) return result;
    const buffer = await this.bufferHours();
    const windowStart = addHours(from, -buffer);
    const windowEnd = addHours(to, buffer);
    const vehicles = await prisma.vehicle.findMany({
      where: {
        carModelId: { in: models.map((m) => m.id) },
        status: "AVAILABLE",
      },
      select: {
        id: true,
        carModelId: true,
        branch: { select: { cityId: true, active: true } },
      },
    });
    const busy = await this.busyVehicleIds(
      vehicles.map((v) => v.id),
      windowStart,
      windowEnd
    );
    for (const model of models) {
      const free = vehicles.filter(
        (v) =>
          v.carModelId === model.id &&
          v.branch?.active &&
          v.branch.cityId === model.cityId &&
          !busy.has(v.id)
      );
      result.set(model.id, {
        available: free.length > 0,
        vehicleId: free[0]?.id ?? null,
        availableCount: free.length,
      });
    }
    return result;
  }

  monthBounds(month?: string, from?: string) {
    let year: number;
    let mo: number;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      year = Number(month.slice(0, 4));
      mo = Number(month.slice(5, 7));
    } else {
      const anchor = from ? new Date(from) : new Date();
      year = anchor.getUTCFullYear();
      mo = anchor.getUTCMonth() + 1;
    }
    const start = new Date(Date.UTC(year, mo - 1, 1));
    const end = new Date(Date.UTC(year, mo, 1));
    return { start, end, key: `${year}-${String(mo).padStart(2, "0")}` };
  }

  async busyDaysForModel(
    carModelId: string,
    cityId: string,
    start: Date,
    end: Date,
    buffer: number
  ) {
    const vehicles = await prisma.vehicle.findMany({
      where: {
        carModelId,
        status: "AVAILABLE",
        branch: { cityId, active: true },
      },
      select: { id: true },
    });
    const days: string[] = [];
    const cursor = new Date(start);
    if (!vehicles.length) {
      while (cursor < end) {
        days.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return days;
    }

    const ids = vehicles.map((v) => v.id);
    const windowStart = addHours(start, -buffer);
    const windowEnd = addHours(end, buffer);
    const [bookings, blocks, jobs] = await Promise.all([
      prisma.booking.findMany({
        where: {
          vehicleId: { in: ids },
          status: { in: BLOCKING },
          startsAt: { lt: windowEnd },
          endsAt: { gt: windowStart },
        },
        select: { vehicleId: true, startsAt: true, endsAt: true },
      }),
      prisma.availabilityBlock.findMany({
        where: {
          vehicleId: { in: ids },
          startsAt: { lt: windowEnd },
          endsAt: { gt: windowStart },
        },
        select: { vehicleId: true, startsAt: true, endsAt: true },
      }),
      prisma.maintenanceJob.findMany({
        where: {
          vehicleId: { in: ids },
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
          startsAt: { lt: windowEnd },
          endsAt: { gt: windowStart },
        },
        select: { vehicleId: true, startsAt: true, endsAt: true },
      }),
    ]);
    const intervals = [...bookings, ...blocks, ...jobs].filter(
      (iv): iv is { vehicleId: string | null; startsAt: Date; endsAt: Date } =>
        iv.startsAt != null && iv.endsAt != null
    );

    while (cursor < end) {
      const dayFrom = new Date(cursor);
      const dayTo = new Date(cursor);
      dayTo.setUTCDate(dayTo.getUTCDate() + 1);
      const from = addHours(dayFrom, -buffer);
      const to = addHours(dayTo, buffer);
      const anyFree = vehicles.some(
        (v) =>
          !intervals.some(
            (iv) =>
              iv.vehicleId === v.id &&
              iv.startsAt != null &&
              iv.endsAt != null &&
              iv.startsAt < to &&
              iv.endsAt > from
          )
      );
      if (!anyFree) days.push(dayFrom.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return days;
  }

  async findFreeVehicle(carModelId: string, from: Date, to: Date, cityId?: string, db: Db = prisma) {
    const buffer = await this.bufferHours();
    const windowStart = addHours(from, -buffer);
    const windowEnd = addHours(to, buffer);
    const vehicles = await db.vehicle.findMany({
      where: {
        carModelId,
        status: "AVAILABLE",
        ...(cityId ? { branch: { cityId, active: true } } : {}),
      },
      include: { branch: true },
    });
    if (!vehicles.length) return null;
    const busy = await this.busyVehicleIds(
      vehicles.map((v) => v.id),
      windowStart,
      windowEnd,
      db
    );
    return vehicles.find((vehicle) => !busy.has(vehicle.id)) ?? null;
  }

  async countFreeVehicles(carModelId: string, from: Date, to: Date, cityId?: string) {
    const buffer = await this.bufferHours();
    const windowStart = addHours(from, -buffer);
    const windowEnd = addHours(to, buffer);
    const vehicles = await prisma.vehicle.findMany({
      where: {
        carModelId,
        status: "AVAILABLE",
        ...(cityId ? { branch: { cityId, active: true } } : {}),
      },
      select: { id: true },
    });
    if (!vehicles.length) return 0;
    const busy = await this.busyVehicleIds(
      vehicles.map((v) => v.id),
      windowStart,
      windowEnd
    );
    return vehicles.reduce((n, v) => n + (busy.has(v.id) ? 0 : 1), 0);
  }

  private async busyVehicleIds(ids: string[], from: Date, to: Date, db: Db = prisma) {
    if (!ids.length) return new Set<string>();
    const [bookings, blocks, jobs] = await Promise.all([
      db.booking.findMany({
        where: {
          vehicleId: { in: ids },
          status: { in: BLOCKING },
          startsAt: { lt: to },
          endsAt: { gt: from },
        },
        select: { vehicleId: true },
      }),
      db.availabilityBlock.findMany({
        where: { vehicleId: { in: ids }, startsAt: { lt: to }, endsAt: { gt: from } },
        select: { vehicleId: true },
      }),
      db.maintenanceJob.findMany({
        where: {
          vehicleId: { in: ids },
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
          startsAt: { lt: to },
          endsAt: { gt: from },
        },
        select: { vehicleId: true },
      }),
    ]);
    return new Set(
      [...bookings, ...blocks, ...jobs].map((row) => row.vehicleId).filter(Boolean) as string[]
    );
  }

  async vehicleBusy(vehicleId: string, from: Date, to: Date, db: Db = prisma) {
    const busy = await this.busyVehicleIds([vehicleId], from, to, db);
    return busy.has(vehicleId);
  }

  private mockFleet() {
    return (
      process.env.PAYMENTS_MOCK === "true" ||
      process.env.BOOKINGS_MOCK === "true" ||
      process.env.NODE_ENV === "development"
    );
  }

  private async ensureMockVehicle(tx: Db, carModelId: string) {
    const model = await tx.carModel.findUnique({
      where: { id: carModelId },
      select: {
        cityId: true,
        city: {
          select: {
            branches: { where: { active: true }, select: { id: true }, take: 1 },
          },
        },
      },
    });
    const branchId =
      model?.city?.branches?.[0]?.id ||
      (
        await tx.branch.findFirst({
          where: model?.cityId ? { cityId: model.cityId, active: true } : { active: true },
          select: { id: true },
        })
      )?.id;
    if (!branchId) throw new BadRequestException("No pickup branch configured");

    const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    return tx.vehicle.create({
      data: {
        registration: `MOCK${stamp}`.slice(0, 16),
        carModelId,
        branchId,
        ownerType: "COMPANY",
        status: "AVAILABLE",
        color: "mock",
        year: new Date().getFullYear(),
      },
    });
  }

  async reserve(body: {
    carModelId: string;
    vehicleId?: string;
    startsAt: string;
    endsAt: string;
    bookingId: string;
  }) {
    const from = new Date(body.startsAt);
    const to = new Date(body.endsAt);
    if (!(from < to)) throw new BadRequestException("from must be before to");
    const mock = this.mockFleet();

    return prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM "Vehicle"
          WHERE "carModelId" = ${body.carModelId}
            AND status = 'AVAILABLE'::"VehicleStatus"
          FOR UPDATE
        `;
        const model = await tx.carModel.findUnique({ where: { id: body.carModelId } });
        let vehicle = body.vehicleId
          ? await tx.vehicle.findUnique({ where: { id: body.vehicleId } })
          : await this.findFreeVehicle(body.carModelId, from, to, model?.cityId, tx);
        if (!vehicle && mock && !body.vehicleId) {
          vehicle = await this.findFreeVehicle(body.carModelId, from, to, undefined, tx);
        }
        if (!vehicle && mock) {
          vehicle = await this.ensureMockVehicle(tx, body.carModelId);
        }
        if (!vehicle) throw new BadRequestException("No vehicle available");
        const buffer = await this.bufferHours();
        const busy = await this.vehicleBusy(
          vehicle.id,
          addHours(from, -buffer),
          addHours(to, buffer),
          tx
        );
        if (busy) {
          if (!mock) throw new BadRequestException("Vehicle no longer free");
          vehicle = await this.ensureMockVehicle(tx, body.carModelId);
        }
        const block = await tx.availabilityBlock.create({
          data: {
            vehicleId: vehicle.id,
            startsAt: from,
            endsAt: to,
            reason: `HOLD:${body.bookingId}`,
          },
        });
        return { vehicleId: vehicle.id, blockId: block.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    ).then(async (reserved) => {
      await invalidateCatalogCache();
      return reserved;
    });
  }

  async release(bookingId: string) {
    const result = await prisma.availabilityBlock.deleteMany({
      where: { reason: { in: [`HOLD:${bookingId}`, `BOOKING:${bookingId}`] } },
    });
    await invalidateCatalogCache();
    return { released: result.count };
  }

  async confirmHold(bookingId: string) {
    await prisma.availabilityBlock.updateMany({
      where: { reason: `HOLD:${bookingId}` },
      data: { reason: `BOOKING:${bookingId}` },
    });
    await invalidateCatalogCache();
    return { ok: true };
  }

  listAdminModels() {
    return prisma.carModel.findMany({
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 8, select: { id: true, url: true, sortOrder: true } },
        pricingRules: true,
        city: { select: { id: true, name: true, slug: true } },
        vehicles: { select: { id: true, registration: true, status: true, branchId: true } },
      },
      orderBy: { displayOrder: "asc" },
    });
  }

  async createModel(body: Record<string, unknown>) {
    const slug = String(body.slug ?? String(body.name).toLowerCase().replace(/\s+/g, "-"));
    const created = await prisma.carModel.create({
      data: {
        slug,
        name: String(body.name),
        type: String(body.type ?? "hatchback"),
        seats: Number(body.seats ?? 5),
        fuel: String(body.fuel ?? "petrol"),
        transmission: String(body.transmission ?? "manual"),
        cityId: String(body.cityId),
        published: Boolean(body.published ?? false),
        featured: Boolean(body.featured ?? false),
        displayOrder: Number(body.displayOrder ?? 999),
        tokenPaise: tokenPaiseFrom(body, 50000),
        images: Array.isArray(body.images)
          ? {
              create: (body.images as { url?: string }[])
                .map((img, i) => ({
                  url: typeof img === "string" ? img : String(img.url ?? ""),
                  sortOrder: i,
                }))
                .filter((img) => img.url),
            }
          : undefined,
      },
      include: { images: true, pricingRules: true, city: true },
    });
    await invalidateCatalogCache();
    return created;
  }

  async updateModel(id: string, body: Record<string, unknown>) {
    const updated = await prisma.carModel.update({
      where: { id },
      data: {
        name: body.name != null ? String(body.name) : undefined,
        slug: body.slug != null ? String(body.slug) : undefined,
        type: body.type != null ? String(body.type) : undefined,
        seats: body.seats != null ? Number(body.seats) : undefined,
        fuel: body.fuel != null ? String(body.fuel) : undefined,
        transmission: body.transmission != null ? String(body.transmission) : undefined,
        cityId: body.cityId != null ? String(body.cityId) : undefined,
        published: body.published != null ? Boolean(body.published) : undefined,
        featured: body.featured != null ? Boolean(body.featured) : undefined,
        displayOrder: body.displayOrder != null ? Number(body.displayOrder) : undefined,
        tokenPaise: body.tokenPaise != null ? tokenPaiseFrom(body) : undefined,
      },
    });
    if (Array.isArray(body.images)) {
      await prisma.carImage.deleteMany({ where: { carModelId: id } });
      const rows = (body.images as { url?: string }[])
        .map((img, i) => ({
          carModelId: id,
          url: typeof img === "string" ? img : String(img.url ?? ""),
          sortOrder: i,
        }))
        .filter((img) => img.url);
      if (rows.length) await prisma.carImage.createMany({ data: rows });
    }
    const row = await prisma.carModel.findUnique({
      where: { id: updated.id },
      include: { images: { orderBy: { sortOrder: "asc" } }, pricingRules: true, city: true, vehicles: true },
    });
    await invalidateCatalogCache();
    return row;
  }

  async deleteModel(id: string) {
    const deleted = await prisma.carModel.delete({ where: { id } });
    await invalidateCatalogCache();
    return deleted;
  }

  listPricing(carModelId?: string) {
    return prisma.pricingRule.findMany({
      where: carModelId ? { carModelId } : undefined,
      include: { carModel: { select: { name: true, slug: true } } },
      orderBy: [{ carModelId: "asc" }, { rentalType: "asc" }],
    });
  }

  createPricing(body: {
    carModelId: string;
    rentalType: RentalType;
    dailyPaise: number;
    under12Paise?: number;
    hourlyPaise?: number;
    extraKmPaise?: number;
    depositPaise?: number;
    startsOn?: string | null;
    endsOn?: string | null;
  }) {
    return prisma.pricingRule.create({
      data: {
        carModelId: body.carModelId,
        rentalType: body.rentalType,
        dailyPaise: Number(body.dailyPaise),
        under12Paise: body.under12Paise != null ? Number(body.under12Paise) : undefined,
        hourlyPaise: body.hourlyPaise != null ? Number(body.hourlyPaise) : undefined,
        extraKmPaise: body.extraKmPaise != null ? Number(body.extraKmPaise) : undefined,
        depositPaise: body.depositPaise != null ? Number(body.depositPaise) : 0,
        startsOn: body.startsOn ? new Date(body.startsOn) : null,
        endsOn: body.endsOn ? new Date(body.endsOn) : null,
      },
    });
  }

  async upsertPricing(body: {
    id?: string;
    carModelId: string;
    rentalType: RentalType;
    dailyPaise: number;
    under12Paise?: number;
    hourlyPaise?: number;
    extraKmPaise?: number;
    depositPaise?: number;
    startsOn?: string | null;
    endsOn?: string | null;
  }) {
    if (body.id) return this.updatePricing(body.id, body);
    const existing = await prisma.pricingRule.findFirst({
      where: {
        carModelId: body.carModelId,
        rentalType: body.rentalType,
        startsOn: body.startsOn ? new Date(body.startsOn) : null,
      },
    });
    if (existing) return this.updatePricing(existing.id, body);
    return this.createPricing(body);
  }

  updatePricing(id: string, body: Record<string, unknown>) {
    return prisma.pricingRule.update({
      where: { id },
      data: {
        dailyPaise: body.dailyPaise != null ? Number(body.dailyPaise) : undefined,
        under12Paise:
          body.under12Paise === null
            ? null
            : body.under12Paise != null
              ? Number(body.under12Paise)
              : undefined,
        hourlyPaise: body.hourlyPaise != null ? Number(body.hourlyPaise) : undefined,
        extraKmPaise: body.extraKmPaise != null ? Number(body.extraKmPaise) : undefined,
        depositPaise: body.depositPaise != null ? Number(body.depositPaise) : undefined,
        rentalType: body.rentalType as RentalType | undefined,
        startsOn:
          body.startsOn === null
            ? null
            : body.startsOn != null
              ? new Date(String(body.startsOn))
              : undefined,
        endsOn:
          body.endsOn === null
            ? null
            : body.endsOn != null
              ? new Date(String(body.endsOn))
              : undefined,
      },
    });
  }

  deletePricing(id: string) {
    return prisma.pricingRule.delete({ where: { id } });
  }

  listBlocks(query: { vehicleId?: string; carModelId?: string }) {
    return prisma.availabilityBlock.findMany({
      where: {
        vehicleId: query.vehicleId || undefined,
        vehicle: query.carModelId ? { carModelId: query.carModelId } : undefined,
      },
      include: {
        vehicle: { include: { carModel: { select: { name: true, slug: true } }, branch: true } },
      },
      orderBy: { startsAt: "desc" },
      take: 200,
    });
  }

  async vehicleCalendar(vehicleId: string, month?: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        carModel: { select: { id: true, name: true, slug: true } },
        branch: { include: { city: { select: { id: true, name: true, slug: true } } } },
      },
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found");

    const cal = this.monthBounds(month);
    const windowStart = cal.start;
    const windowEnd = cal.end;
    const [bookings, blocks, jobs] = await Promise.all([
      prisma.booking.findMany({
        where: {
          vehicleId,
          status: { in: BLOCKING },
          startsAt: { lt: windowEnd },
          endsAt: { gt: windowStart },
        },
        select: { id: true, publicId: true, startsAt: true, endsAt: true, status: true },
      }),
      prisma.availabilityBlock.findMany({
        where: {
          vehicleId,
          startsAt: { lt: windowEnd },
          endsAt: { gt: windowStart },
        },
        select: { id: true, startsAt: true, endsAt: true, reason: true },
      }),
      prisma.maintenanceJob.findMany({
        where: {
          vehicleId,
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
          startsAt: { lt: windowEnd },
          endsAt: { gt: windowStart },
        },
        select: { id: true, startsAt: true, endsAt: true, status: true, type: true },
      }),
    ]);

    const vehicleUnavailable = ["BLOCKED", "MAINTENANCE", "SOLD", "ON_TRIP"].includes(
      vehicle.status
    );
    const days: {
      date: string;
      status: "available" | "unavailable" | "blocked";
      reason: string | null;
      blockId: string | null;
      canToggle: boolean;
    }[] = [];

    const cursor = new Date(cal.start);
    while (cursor < cal.end) {
      const dayFrom = new Date(cursor);
      const dayTo = new Date(cursor);
      dayTo.setUTCDate(dayTo.getUTCDate() + 1);
      const date = dayFrom.toISOString().slice(0, 10);

      if (vehicleUnavailable) {
        days.push({
          date,
          status: vehicle.status === "BLOCKED" ? "blocked" : "unavailable",
          reason: `vehicle:${vehicle.status.toLowerCase()}`,
          blockId: null,
          canToggle: false,
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        continue;
      }

      const booking = bookings.find((b) => b.startsAt < dayTo && b.endsAt > dayFrom);
      if (booking) {
        days.push({
          date,
          status: "unavailable",
          reason: `booking:${booking.publicId}`,
          blockId: null,
          canToggle: false,
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        continue;
      }

      const job = jobs.find(
        (j) =>
          j.startsAt != null && j.endsAt != null && j.startsAt < dayTo && j.endsAt > dayFrom
      );
      if (job) {
        days.push({
          date,
          status: "unavailable",
          reason: `maintenance:${job.type}`,
          blockId: null,
          canToggle: false,
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        continue;
      }

      const block = blocks.find((b) => b.startsAt < dayTo && b.endsAt > dayFrom);
      if (block) {
        const isHold = block.reason.startsWith("HOLD:") || block.reason.startsWith("BOOKING:");
        days.push({
          date,
          status: isHold ? "unavailable" : "blocked",
          reason: block.reason,
          blockId: isHold ? null : block.id,
          canToggle: !isHold,
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        continue;
      }

      days.push({
        date,
        status: "available",
        reason: null,
        blockId: null,
        canToggle: true,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return {
      month: cal.key,
      vehicle: {
        id: vehicle.id,
        registration: vehicle.registration,
        status: vehicle.status,
        carModel: vehicle.carModel,
        branch: vehicle.branch,
      },
      days,
    };
  }

  async blockDay(body: { vehicleId: string; date: string; reason?: string }) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      throw new BadRequestException("date must be YYYY-MM-DD");
    }
    const vehicle = await prisma.vehicle.findUnique({ where: { id: body.vehicleId } });
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    if (vehicle.status !== "AVAILABLE") {
      throw new BadRequestException(
        `Vehicle is ${vehicle.status}; set status to AVAILABLE first`
      );
    }

    const startsAt = new Date(`${body.date}T00:00:00.000Z`);
    const endsAt = new Date(startsAt);
    endsAt.setUTCDate(endsAt.getUTCDate() + 1);

    const busy = await this.vehicleBusy(vehicle.id, startsAt, endsAt);
    if (busy) {
      throw new BadRequestException("Day already unavailable (booking, hold, or maintenance)");
    }

    const reasonRaw = String(body.reason || "blocked").trim() || "blocked";
    const reason =
      reasonRaw.startsWith("HOLD:") ||
      reasonRaw.startsWith("BOOKING:") ||
      reasonRaw.startsWith("MAINT:")
        ? reasonRaw
        : `MANUAL:${reasonRaw}`;

    return prisma.availabilityBlock.create({
      data: { vehicleId: vehicle.id, startsAt, endsAt, reason },
      include: { vehicle: { include: { carModel: true } } },
    });
  }

  async unblockDay(body: { vehicleId: string; date: string }) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      throw new BadRequestException("date must be YYYY-MM-DD");
    }
    const startsAt = new Date(`${body.date}T00:00:00.000Z`);
    const endsAt = new Date(startsAt);
    endsAt.setUTCDate(endsAt.getUTCDate() + 1);

    const blocks = await prisma.availabilityBlock.findMany({
      where: {
        vehicleId: body.vehicleId,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    const removable = blocks.filter(
      (b) => !b.reason.startsWith("HOLD:") && !b.reason.startsWith("BOOKING:")
    );
    if (!removable.length) {
      throw new BadRequestException(
        "No manual block on this day (booking holds cannot be cleared here)"
      );
    }
    await prisma.availabilityBlock.deleteMany({
      where: { id: { in: removable.map((b) => b.id) } },
    });
    return { removed: removable.length, date: body.date };
  }

  async createBlock(body: {
    vehicleId: string;
    startsAt: string;
    endsAt: string;
    reason?: string;
  }) {
    const from = new Date(body.startsAt);
    const to = new Date(body.endsAt);
    if (!(from < to)) throw new BadRequestException("from must be before to");
    const vehicle = await prisma.vehicle.findUnique({ where: { id: body.vehicleId } });
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    const reason = String(body.reason || "manual").trim();
    return prisma.availabilityBlock.create({
      data: {
        vehicleId: vehicle.id,
        startsAt: from,
        endsAt: to,
        reason: reason.startsWith("HOLD:") || reason.startsWith("BOOKING:") || reason.startsWith("MAINT:")
          ? reason
          : `MANUAL:${reason}`,
      },
      include: { vehicle: { include: { carModel: true } } },
    });
  }

  async deleteBlock(id: string) {
    const block = await prisma.availabilityBlock.findUnique({ where: { id } });
    if (!block) throw new NotFoundException("Block not found");
    if (block.reason.startsWith("HOLD:") || block.reason.startsWith("BOOKING:")) {
      throw new BadRequestException("Release booking holds from the booking, not here");
    }
    return prisma.availabilityBlock.delete({ where: { id } });
  }

  pickRule(rules: PriceRow[], rentalType: RentalType, at: Date | null) {
    const typed = rules.filter((r) => r.rentalType === rentalType);
    const pool = typed.length
      ? typed
      : rules.filter((r) => r.rentalType === "SELF_DRIVE");
    const fallback = pool.length ? pool : rules;
    if (!fallback.length) return null;
    const base = fallback.filter((r) => !r.startsOn && !r.endsOn);
    if (!at) return base[0] ?? fallback[0];
    const seasonal = fallback.filter((r) => {
      if (!r.startsOn && !r.endsOn) return false;
      if (r.startsOn && at < r.startsOn) return false;
      if (r.endsOn && at > r.endsOn) return false;
      return true;
    });
    if (seasonal.length) {
      seasonal.sort((a, b) => {
        const aSpan = (a.endsOn?.getTime() ?? Number.MAX_SAFE_INTEGER) - (a.startsOn?.getTime() ?? 0);
        const bSpan = (b.endsOn?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.startsOn?.getTime() ?? 0);
        return aSpan - bSpan;
      });
      return seasonal[0];
    }
    return base[0] ?? fallback[0];
  }

  normalizeRentalType(value?: string): RentalType {
    if (value && RENTAL_TYPES.has(value)) return value as RentalType;
    return "SELF_DRIVE";
  }
}

function tokenPaiseFrom(body: Record<string, unknown>, fallback = 50000) {
  if (body.tokenPaise == null || body.tokenPaise === "") return fallback;
  const n = Math.round(Number(body.tokenPaise));
  if (!Number.isFinite(n) || n < 100) {
    throw new BadRequestException("Token amount must be at least ₹1");
  }
  if (n > 10_000_000) throw new BadRequestException("Token amount is too high");
  return n;
}
