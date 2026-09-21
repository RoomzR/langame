import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  attach(server: Server) {
    this.server = server;
  }

  emitToClub(clubId: string, event: string, payload: unknown) {
    this.server?.to(`club:${clubId}`).emit(event, payload);
  }

  emitToSeat(seatId: string, event: string, payload: unknown) {
    this.server?.to(`seat:${seatId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  emitBoth(clubId: string, seatId: string, event: string, payload: unknown) {
    this.emitToClub(clubId, event, payload);
    this.emitToSeat(seatId, event, payload);
  }
}
