import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BookingStatus, RentalType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { addHours } from "../../lib/http";

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

@Injectable()
export class CatalogService {
  bufferHours() {
    return Number(process.env.BUFFER_HOURS ?? 3);
  }

  async search(query: {
    cityId?: string;
    from?: string;
    to?: string;
    rentalType?: RentalType;
    seats?: string;
    fuel?: string;
    transmission?: string;
    minPrice?: string;
    maxPrice?: string;
  }) {
    const models = await prisma.carModel.findMany({
      where: {
        published: true,
        cityId: query.cityId || undefined,
        seats: query.seats ? Number(query.seats) : undefined,
        fuel: query.fuel || undefined,
        transmission: query.transmission || undefined,
      },
      include: { images: { orderBy: { sortOrder: "asc" } }, pricingRules: true, city: true },
      orderBy: [{ featured: "desc" }, { displayOrder: "asc" }],
    });

    const rentalType = query.rentalType ?? "SELF_DRIVE";
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;

    const results = [];
    for (const model of models) {
      const rule = this.pickRule(model.pricingRules, rentalType);
      if (!rule) continue;
      if (query.minPrice && rule.dailyPaise < Number(query.minPrice)) continue;
      if (query.maxPrice && rule.dailyPaise > Number(query.maxPrice)) continue;
      let available = true;
      let vehicleId: string | null = null;
      if (from && to) {
        const vehicle = await this.findFreeVehicle(model.id, from, to);
        available = Boolean(vehicle);
        vehicleId = vehicle?.id ?? null;
      }
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
        available,
        vehicleId,
      });
    }
    return results;
  }

  async bySlug(slug: string) {
    const model = await prisma.carModel.findUnique({
      where: { slug },
      include: { images: { orderBy: { sortOrder: "asc" } }, pricingRules: true, city: true },
    });
    if (!model || !model.published) throw new NotFoundException("Car not found");
    return model;
  }

  async availability(id: string, from: string, to: string) {
    const start = new Date(from);
    const end = new Date(to);
    if (!(start < end)) throw new BadRequestException("from must be before to");
    const vehicle = await this.findFreeVehicle(id, start, end);
    const model = await prisma.carModel.findUnique({
      where: { id },
      include: { pricingRules: true },
    });
    if (!model) throw new NotFoundException("Car not found");
    return {
      available: Boolean(vehicle),
      vehicleId: vehicle?.id ?? null,
      bufferHours: this.bufferHours(),
    };
  }

  async findFreeVehicle(carModelId: string, from: Date, to: Date) {
    const buffer = this.bufferHours();
    const windowStart = addHours(from, -buffer);
    const windowEnd = addHours(to, buffer);
    const vehicles = await prisma.vehicle.findMany({
      where: { carModelId, status: "AVAILABLE" },
      include: { branch: true },
    });
    for (const vehicle of vehicles) {
      const busy = await this.vehicleBusy(vehicle.id, windowStart, windowEnd);
      if (!busy) return vehicle;
    }
    return null;
  }

  async vehicleBusy(vehicleId: string, from: Date, to: Date) {
    const booking = await prisma.booking.findFirst({
      where: {
        vehicleId,
        status: { in: BLOCKING },
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
    });
    if (booking) return true;
    const block = await prisma.availabilityBlock.findFirst({
      where: { vehicleId, startsAt: { lt: to }, endsAt: { gt: from } },
    });
    if (block) return true;
    const job = await prisma.maintenanceJob.findFirst({
      where: { vehicleId, startsAt: { lt: to }, endsAt: { gt: from } },
    });
    return Boolean(job);
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
    const vehicle = body.vehicleId
      ? await prisma.vehicle.findUnique({ where: { id: body.vehicleId } })
      : await this.findFreeVehicle(body.carModelId, from, to);
    if (!vehicle) throw new BadRequestException("No vehicle available");
    const busy = await this.vehicleBusy(
      vehicle.id,
      addHours(from, -this.bufferHours()),
      addHours(to, this.bufferHours())
    );
    if (busy) throw new BadRequestException("Vehicle no longer free");
    const block = await prisma.availabilityBlock.create({
      data: {
        vehicleId: vehicle.id,
        startsAt: from,
        endsAt: to,
        reason: `HOLD:${body.bookingId}`,
      },
    });
    return { vehicleId: vehicle.id, blockId: block.id };
  }

  async release(bookingId: string) {
    const result = await prisma.availabilityBlock.deleteMany({
      where: { reason: { in: [`HOLD:${bookingId}`, `BOOKING:${bookingId}`] } },
    });
    return { released: result.count };
  }

  async confirmHold(bookingId: string) {
    await prisma.availabilityBlock.updateMany({
      where: { reason: `HOLD:${bookingId}` },
      data: { reason: `BOOKING:${bookingId}` },
    });
    return { ok: true };
  }

  listAdminModels() {
    return prisma.carModel.findMany({
      include: { images: true, pricingRules: true, city: true, vehicles: true },
      orderBy: { displayOrder: "asc" },
    });
  }

  async createModel(body: Record<string, unknown>) {
    const slug = String(body.slug ?? String(body.name).toLowerCase().replace(/\s+/g, "-"));
    return prisma.carModel.create({
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
        images: Array.isArray(body.images)
          ? {
              create: (body.images as { url: string }[]).map((img, i) => ({
                url: img.url,
                sortOrder: i,
              })),
            }
          : undefined,
      },
      include: { images: true },
    });
  }

  async updateModel(id: string, body: Record<string, unknown>) {
    return prisma.carModel.update({
      where: { id },
      data: {
        name: body.name != null ? String(body.name) : undefined,
        type: body.type != null ? String(body.type) : undefined,
        seats: body.seats != null ? Number(body.seats) : undefined,
        fuel: body.fuel != null ? String(body.fuel) : undefined,
        transmission: body.transmission != null ? String(body.transmission) : undefined,
        published: body.published != null ? Boolean(body.published) : undefined,
        featured: body.featured != null ? Boolean(body.featured) : undefined,
        displayOrder: body.displayOrder != null ? Number(body.displayOrder) : undefined,
      },
    });
  }

  deleteModel(id: string) {
    return prisma.carModel.delete({ where: { id } });
  }

  listPricing(carModelId?: string) {
    return prisma.pricingRule.findMany({
      where: carModelId ? { carModelId } : undefined,
      include: { carModel: { select: { name: true, slug: true } } },
    });
  }

  createPricing(body: {
    carModelId: string;
    rentalType: RentalType;
    dailyPaise: number;
    hourlyPaise?: number;
    extraKmPaise?: number;
    depositPaise?: number;
  }) {
    return prisma.pricingRule.create({ data: body });
  }

  updatePricing(id: string, body: Record<string, unknown>) {
    return prisma.pricingRule.update({
      where: { id },
      data: {
        dailyPaise: body.dailyPaise != null ? Number(body.dailyPaise) : undefined,
        hourlyPaise: body.hourlyPaise != null ? Number(body.hourlyPaise) : undefined,
        extraKmPaise: body.extraKmPaise != null ? Number(body.extraKmPaise) : undefined,
        depositPaise: body.depositPaise != null ? Number(body.depositPaise) : undefined,
        rentalType: body.rentalType as RentalType | undefined,
      },
    });
  }

  deletePricing(id: string) {
    return prisma.pricingRule.delete({ where: { id } });
  }

  pickRule(
    rules: { rentalType: RentalType; dailyPaise: number; extraKmPaise: number | null; depositPaise: number; hourlyPaise: number | null }[],
    rentalType: RentalType
  ) {
    return (
      rules.find((r) => r.rentalType === rentalType) ??
      rules.find((r) => r.rentalType === "SELF_DRIVE") ??
      rules[0]
    );
  }
}
