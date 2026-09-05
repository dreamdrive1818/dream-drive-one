import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  MaintenanceJobStatus,
  MaintenanceJobType,
  Prisma,
  VehicleStatus,
} from "@prisma/client";
import { prisma } from "./lib/prisma";

const JOB_INCLUDE = {
  vehicle: {
    include: {
      carModel: { select: { id: true, name: true, slug: true } },
      branch: { select: { id: true, name: true, cityId: true, city: { select: { name: true } } } },
    },
  },
  workshop: true,
  parts: true,
} satisfies Prisma.MaintenanceJobInclude;

const OPEN_STATUSES: MaintenanceJobStatus[] = ["OPEN", "SCHEDULED", "IN_PROGRESS"];
const BLOCKING_STATUSES: MaintenanceJobStatus[] = ["SCHEDULED", "IN_PROGRESS"];

export type MaintPartInput = { name: string; qty: number; unitPaise?: number };

export type JobInput = {
  vehicleId: string;
  workshopId?: string | null;
  type?: MaintenanceJobType | string;
  startsAt?: string | null;
  endsAt?: string | null;
  labourPaise?: number;
  costPaise?: number;
  odometerKm?: number;
  notes?: string | null;
  parts?: MaintPartInput[];
};

@Injectable()
export class MaintenanceEngine {
  workshops(cityId?: string) {
    return prisma.workshop.findMany({
      where: cityId ? { cityId } : undefined,
      include: { city: { select: { id: true, name: true, slug: true } }, _count: { select: { jobs: true } } },
      orderBy: { name: "asc" },
    });
  }

  async createWorkshop(body: { name: string; address: string; phone?: string; cityId?: string; active?: boolean }) {
    if (!body.name?.trim() || !body.address?.trim()) {
      throw new BadRequestException("Workshop name and address required");
    }
    if (body.cityId) {
      const city = await prisma.city.findUnique({ where: { id: body.cityId } });
      if (!city) throw new NotFoundException("City not found");
    }
    return prisma.workshop.create({
      data: {
        name: body.name.trim(),
        address: body.address.trim(),
        phone: body.phone?.trim() || null,
        cityId: body.cityId || null,
        active: body.active ?? true,
      },
      include: { city: { select: { id: true, name: true } } },
    });
  }

  async updateWorkshop(id: string, body: Record<string, unknown>) {
    await this.requireWorkshop(id);
    return prisma.workshop.update({
      where: { id },
      data: {
        name: body.name != null ? String(body.name).trim() : undefined,
        address: body.address != null ? String(body.address).trim() : undefined,
        phone: body.phone != null ? String(body.phone).trim() || null : undefined,
        cityId: body.cityId === "" || body.cityId === null ? null : body.cityId != null ? String(body.cityId) : undefined,
        active: body.active != null ? Boolean(body.active) : undefined,
      },
      include: { city: { select: { id: true, name: true } } },
    });
  }

  async deleteWorkshop(id: string) {
    const workshop = await this.requireWorkshop(id);
    const open = await prisma.maintenanceJob.count({
      where: { workshopId: id, status: { in: OPEN_STATUSES } },
    });
    if (open) {
      throw new BadRequestException("Cannot delete a workshop with open jobs");
    }
    if (workshop.jobs.length) {
      return prisma.workshop.update({ where: { id }, data: { active: false } });
    }
    return prisma.workshop.delete({ where: { id } });
  }

  jobs(query: { status?: string; vehicleId?: string; workshopId?: string; branchId?: string } = {}) {
    const status = this.parseStatus(query.status, true);
    return prisma.maintenanceJob.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
        ...(query.workshopId ? { workshopId: query.workshopId } : {}),
        ...(query.branchId ? { vehicle: { branchId: query.branchId } } : {}),
      },
      include: JOB_INCLUDE,
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
      take: 300,
    });
  }

  async getJob(id: string) {
    const job = await prisma.maintenanceJob.findUnique({ where: { id }, include: JOB_INCLUDE });
    if (!job) throw new NotFoundException("Maintenance job not found");
    return job;
  }

  async createJob(body: JobInput) {
    const vehicle = await this.requireVehicle(body.vehicleId);
    const type = this.parseType(body.type);
    const parts = this.normalizeParts(body.parts);
    const labourPaise = this.money(body.labourPaise, 0);
    const dates = this.parseDates(body.startsAt, body.endsAt, false);
    if (body.workshopId) await this.requireWorkshop(body.workshopId);

    if (dates) {
      await this.assertNoOngoing(vehicle.id, dates.from, dates.to);
    } else {
      await this.flagSwapDueIfOnTrip(vehicle.id);
    }

    const costPaise = body.costPaise != null ? this.money(body.costPaise, 0) : labourPaise + this.partsTotal(parts);
    const status: MaintenanceJobStatus = dates ? (dates.from.getTime() <= Date.now() ? "IN_PROGRESS" : "SCHEDULED") : "OPEN";

    const job = await prisma.maintenanceJob.create({
      data: {
        vehicleId: vehicle.id,
        workshopId: body.workshopId || null,
        type,
        status,
        startsAt: dates?.from,
        endsAt: dates?.to,
        labourPaise,
        costPaise,
        odometerKm: body.odometerKm != null ? this.int(body.odometerKm) : null,
        notes: body.notes?.trim() || null,
        parts: parts.length ? { create: parts } : undefined,
      },
      include: JOB_INCLUDE,
    });

    if (dates) {
      await this.syncBlock(job.id, vehicle.id, dates.from, dates.to);
      await this.setVehicleMaintenance(vehicle.id);
    }
    return this.getJob(job.id);
  }

  async updateJob(id: string, body: JobInput & { status?: string }) {
    const existing = await this.getJob(id);
    if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
      throw new BadRequestException("Closed jobs cannot be edited");
    }

    const type = body.type != null ? this.parseType(body.type) : undefined;
    const labourPaise = body.labourPaise != null ? this.money(body.labourPaise, 0) : undefined;
    const parts = body.parts ? this.normalizeParts(body.parts) : undefined;
    const dates =
      body.startsAt != null || body.endsAt != null
        ? this.parseDates(body.startsAt ?? existing.startsAt?.toISOString(), body.endsAt ?? existing.endsAt?.toISOString(), true)
        : existing.startsAt && existing.endsAt
          ? { from: existing.startsAt, to: existing.endsAt }
          : null;

    if (body.workshopId) await this.requireWorkshop(body.workshopId);
    if (dates) await this.assertNoOngoing(existing.vehicleId, dates.from, dates.to, existing.id);

    const nextParts = parts ?? existing.parts.map((p) => ({ name: p.name, qty: p.qty, unitPaise: p.unitPaise }));
    const nextLabour = labourPaise ?? existing.labourPaise;
    const costPaise =
      body.costPaise != null ? this.money(body.costPaise, 0) : nextLabour + this.partsTotal(nextParts);

    let status = existing.status;
    if (dates && (status === "OPEN" || status === "SCHEDULED")) {
      status = dates.from.getTime() <= Date.now() ? "IN_PROGRESS" : "SCHEDULED";
    }
    if (body.status === "IN_PROGRESS") status = "IN_PROGRESS";

    if (parts) {
      await prisma.maintenancePart.deleteMany({ where: { jobId: id } });
    }

    await prisma.maintenanceJob.update({
      where: { id },
      data: {
        workshopId: body.workshopId === "" ? null : body.workshopId != null ? body.workshopId : undefined,
        type,
        status,
        startsAt: dates?.from,
        endsAt: dates?.to,
        labourPaise: nextLabour,
        costPaise,
        odometerKm: body.odometerKm != null ? this.int(body.odometerKm) : undefined,
        notes: body.notes != null ? body.notes.trim() || null : undefined,
        parts: parts ? { create: parts } : undefined,
      },
    });

    if (dates) {
      await this.syncBlock(id, existing.vehicleId, dates.from, dates.to);
      await this.setVehicleMaintenance(existing.vehicleId);
    }
    return this.getJob(id);
  }

  async completeJob(
    id: string,
    body: { odometerKm?: number; costPaise?: number; labourPaise?: number; notes?: string; parts?: MaintPartInput[] }
  ) {
    const job = await this.getJob(id);
    if (job.status === "COMPLETED") throw new BadRequestException("Job already completed");
    if (job.status === "CANCELLED") throw new BadRequestException("Cancelled jobs cannot be completed");

    if (body.odometerKm == null || Number.isNaN(Number(body.odometerKm))) {
      throw new BadRequestException("Completing a job requires odometer");
    }
    const odometerKm = this.int(body.odometerKm);
    if (odometerKm < job.vehicle.odometerKm) {
      throw new BadRequestException(`Odometer cannot be below current ${job.vehicle.odometerKm} km`);
    }

    const parts = body.parts ? this.normalizeParts(body.parts) : job.parts.map((p) => ({ name: p.name, qty: p.qty, unitPaise: p.unitPaise }));
    const labourPaise = body.labourPaise != null ? this.money(body.labourPaise, 0) : job.labourPaise;
    const computed = labourPaise + this.partsTotal(parts);
    if (body.costPaise == null && computed <= 0 && job.costPaise <= 0) {
      throw new BadRequestException("Completing a job requires cost");
    }
    const costPaise = body.costPaise != null ? this.money(body.costPaise, 0) : job.costPaise || computed;

    if (body.parts) {
      await prisma.maintenancePart.deleteMany({ where: { jobId: id } });
    }

    await prisma.maintenanceJob.update({
      where: { id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        odometerKm,
        labourPaise,
        costPaise,
        notes: body.notes != null ? body.notes.trim() || null : job.notes,
        parts: body.parts ? { create: parts } : undefined,
      },
    });

    await prisma.availabilityBlock.deleteMany({ where: { reason: `MAINT:${id}` } });
    await prisma.vehicle.update({
      where: { id: job.vehicleId },
      data: { odometerKm },
    });
    await prisma.vehicleOdometerLog.create({
      data: {
        vehicleId: job.vehicleId,
        km: odometerKm,
        source: "MAINTENANCE",
        notes: `Job ${id}`,
      },
    });
    await this.releaseVehicleIfIdle(job.vehicleId);
    return this.getJob(id);
  }

  async cancelJob(id: string) {
    const job = await this.getJob(id);
    if (job.status === "COMPLETED") throw new BadRequestException("Completed jobs cannot be cancelled");
    if (job.status === "CANCELLED") return job;
    await prisma.maintenanceJob.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    await prisma.availabilityBlock.deleteMany({ where: { reason: `MAINT:${id}` } });
    await this.releaseVehicleIfIdle(job.vehicleId);
    return this.getJob(id);
  }

  private async requireVehicle(id: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: { carModel: { select: { name: true } } },
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    if (vehicle.status === "SOLD") throw new BadRequestException("Cannot book workshop time on a sold vehicle");
    return vehicle;
  }

  private async requireWorkshop(id: string) {
    const workshop = await prisma.workshop.findUnique({
      where: { id },
      include: { jobs: { select: { id: true } } },
    });
    if (!workshop) throw new NotFoundException("Workshop not found");
    return workshop;
  }

  private async assertNoOngoing(vehicleId: string, from: Date, to: Date, ignoreJobId?: string) {
    const ongoing = await prisma.booking.findFirst({
      where: {
        vehicleId,
        status: "ONGOING",
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
      include: { subscription: { include: { plan: true } } },
    });
    if (ongoing) {
      await this.flagSwapDue(ongoing);
      throw new BadRequestException(this.ongoingMessage(ongoing));
    }

    const clash = await prisma.maintenanceJob.findFirst({
      where: {
        vehicleId,
        id: ignoreJobId ? { not: ignoreJobId } : undefined,
        status: { in: BLOCKING_STATUSES },
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
    });
    if (clash) {
      throw new BadRequestException("This vehicle already has a workshop slot in that window");
    }
  }

  private async flagSwapDueIfOnTrip(vehicleId: string) {
    const ongoing = await prisma.booking.findFirst({
      where: { vehicleId, status: "ONGOING" },
      include: { subscription: { include: { plan: true } } },
    });
    if (ongoing?.subscription?.status === "ACTIVE") {
      await this.flagSwapDue(ongoing);
    }
  }

  private async flagSwapDue(booking: {
    subscription: { id: string; status: string; plan: { swapAllowed: boolean } } | null;
  }) {
    if (booking.subscription?.status === "ACTIVE") {
      await prisma.subscription.update({
        where: { id: booking.subscription.id },
        data: { swapDueReason: "SERVICE" },
      });
    }
  }

  private ongoingMessage(booking: {
    publicId?: string;
    subscription: { status: string; plan: { swapAllowed: boolean } } | null;
  }) {
    if (booking.subscription?.status === "ACTIVE") {
      return booking.subscription.plan.swapAllowed
        ? "Vehicle has an ongoing subscription trip. Swap the car first, then schedule workshop. The customer has been notified that a service swap is due."
        : "Vehicle is on an ongoing subscription that does not allow swaps. Pause or close the trip before workshop.";
    }
    return "Vehicle has an ongoing booking in this window. Finish or reassign the trip before workshop.";
  }

  private async syncBlock(jobId: string, vehicleId: string, from: Date, to: Date) {
    const reason = `MAINT:${jobId}`;
    const existing = await prisma.availabilityBlock.findFirst({ where: { reason } });
    if (existing) {
      await prisma.availabilityBlock.update({
        where: { id: existing.id },
        data: { startsAt: from, endsAt: to, vehicleId },
      });
      return;
    }
    await prisma.availabilityBlock.create({
      data: { vehicleId, startsAt: from, endsAt: to, reason },
    });
  }

  private async setVehicleMaintenance(vehicleId: string) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) return;
    if (vehicle.status === "AVAILABLE" || vehicle.status === "MAINTENANCE") {
      await prisma.vehicle.update({ where: { id: vehicleId }, data: { status: "MAINTENANCE" } });
    }
  }

  private async releaseVehicleIfIdle(vehicleId: string) {
    const open = await prisma.maintenanceJob.count({
      where: { vehicleId, status: { in: BLOCKING_STATUSES } },
    });
    if (open) return;
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (vehicle?.status === "MAINTENANCE") {
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: { status: "AVAILABLE" as VehicleStatus },
      });
    }
  }

  private parseDates(startsAt?: string | Date | null, endsAt?: string | Date | null, required = false) {
    if (!startsAt && !endsAt) {
      if (required) throw new BadRequestException("startsAt and endsAt required to schedule");
      return null;
    }
    if (!startsAt || !endsAt) throw new BadRequestException("Both startsAt and endsAt are required to schedule");
    const from = startsAt instanceof Date ? startsAt : new Date(startsAt);
    const to = endsAt instanceof Date ? endsAt : new Date(endsAt);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException("Invalid workshop dates");
    }
    if (!(from < to)) throw new BadRequestException("Workshop start must be before end");
    return { from, to };
  }

  private parseType(value?: string | MaintenanceJobType): MaintenanceJobType {
    const raw = String(value || "PREVENTIVE").toUpperCase();
    if (raw === "BREAKDOWN" || raw === "PREVENTIVE") return raw as MaintenanceJobType;
    throw new BadRequestException("type must be PREVENTIVE or BREAKDOWN");
  }

  private parseStatus(value?: string, optional = false): MaintenanceJobStatus | undefined {
    if (!value) return undefined;
    const raw = value.toUpperCase() as MaintenanceJobStatus;
    const allowed: MaintenanceJobStatus[] = ["OPEN", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
    if (!allowed.includes(raw)) {
      if (optional) return undefined;
      throw new BadRequestException("Invalid job status");
    }
    return raw;
  }

  private normalizeParts(parts?: MaintPartInput[]) {
    return (parts ?? [])
      .filter((p) => p?.name?.trim() && Number(p.qty) > 0)
      .map((p) => ({
        name: p.name.trim(),
        qty: this.int(p.qty),
        unitPaise: this.money(p.unitPaise, 0),
      }));
  }

  private partsTotal(parts: { qty: number; unitPaise: number }[]) {
    return parts.reduce((sum, p) => sum + p.qty * p.unitPaise, 0);
  }

  private money(value: unknown, fallback: number) {
    if (value == null || value === "") return fallback;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) throw new BadRequestException("Money values must be >= 0");
    return Math.round(n);
  }

  private int(value: unknown) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) throw new BadRequestException("Expected a non-negative number");
    return Math.round(n);
  }
}
