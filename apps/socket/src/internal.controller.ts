import { Body, Controller, Post, UnauthorizedException, Headers } from "@nestjs/common";
import { BookingGateway } from "./gateways/booking.gateway";

@Controller()
export class InternalController {
  constructor(private readonly bookings: BookingGateway) {}

  @Post("internal/booking-status")
  emit(
    @Headers("x-internal-token") token: string | undefined,
    @Body()
    body: { bookingId?: string; publicId?: string; status?: string; reason?: string }
  ) {
    const expected = process.env.INTERNAL_TOKEN ?? "dev-internal";
    if (token !== expected) throw new UnauthorizedException("Internal token required");
    if (!body?.bookingId && !body?.publicId) {
      return { ok: false, error: "bookingId required" };
    }
    const payload = {
      bookingId: body.bookingId,
      publicId: body.publicId,
      status: body.status,
      reason: body.reason,
      at: new Date().toISOString(),
    };
    if (body.bookingId) this.bookings.emitStatus(body.bookingId, payload);
    if (body.publicId) this.bookings.emitStatus(body.publicId, payload);
    return { ok: true };
  }
}
