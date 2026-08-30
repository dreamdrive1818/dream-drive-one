import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import type { Server, Socket } from "socket.io";

@WebSocketGateway({
  cors: { origin: true },
  namespace: "/booking",
})
export class BookingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(BookingGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    this.logger.log(`connected ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`disconnected ${client.id}`);
  }

  @SubscribeMessage("booking:subscribe")
  subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { bookingId?: string }
  ) {
    const bookingId = body?.bookingId;
    if (!bookingId) {
      return { ok: false, error: "bookingId required" };
    }
    client.join(`booking:${bookingId}`);
    return { ok: true, room: `booking:${bookingId}` };
  }

  /** Call from API/worker after status changes. */
  emitStatus(bookingId: string, payload: Record<string, unknown>) {
    this.server.to(`booking:${bookingId}`).emit("booking:status", payload);
  }
}
