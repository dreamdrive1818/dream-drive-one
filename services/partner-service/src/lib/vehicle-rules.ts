import { BadRequestException } from "@nestjs/common";
import { prisma } from "./prisma";

export async function assertPartnerContractActive(
  partnerId: string | null | undefined,
  from?: Date,
  to?: Date
) {
  if (!partnerId) throw new BadRequestException("Partner vehicle needs a partner");
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    include: { contracts: true },
  });
  if (!partner) throw new BadRequestException("Partner not found");
  if (!partner.active) throw new BadRequestException("Partner is inactive");
  const start = from ?? new Date();
  const end = to ?? start;
  const covers = partner.contracts.some(
    (contract) => contract.startsOn <= start && (!contract.endsOn || contract.endsOn >= end)
  );
  if (!covers) {
    throw new BadRequestException("Partner has no active contract covering these dates");
  }
}
