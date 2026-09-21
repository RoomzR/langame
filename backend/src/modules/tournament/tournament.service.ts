import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TournamentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

export type BracketMatch = {
  id: string;
  round: number;
  slot: number;
  a: string | null;
  b: string | null;
  winner: string | null;
};

@Injectable()
export class TournamentService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
  ) {}

  list(clubId: string) {
    return this.prisma.tournament.findMany({
      where: { clubId },
      include: { _count: { select: { entries: true } } },
      orderBy: { startsAt: 'desc' },
    });
  }

  async get(id: string) {
    const t = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        entries: { include: { user: { select: { id: true, displayName: true } } } },
      },
    });
    if (!t) throw new NotFoundException({ code: 'TOURNAMENT_NOT_FOUND' });
    return t;
  }

  create(clubId: string, data: { name: string; game?: string; startsAt: Date }) {
    return this.prisma.tournament.create({
      data: { clubId, name: data.name, game: data.game ?? '', startsAt: data.startsAt, status: TournamentStatus.OPEN },
    });
  }

  async join(tournamentId: string, userId: string) {
    const t = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!t) throw new NotFoundException({ code: 'TOURNAMENT_NOT_FOUND' });
    if (t.status !== TournamentStatus.OPEN) throw new BadRequestException({ code: 'NOT_OPEN' });
    return this.prisma.tournamentEntry.create({
      data: { tournamentId, userId },
    });
  }

  async start(tournamentId: string) {
    const t = await this.get(tournamentId);
    if (t.entries.length < 2) throw new BadRequestException({ code: 'NEED_TWO_PLAYERS' });
    if (t.status === TournamentStatus.RUNNING) return t;
    const userIds = t.entries.map((e) => e.userId);
    const bracket = this.buildBracket(userIds);
    const updated = await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: TournamentStatus.RUNNING, bracket },
      include: { entries: { include: { user: { select: { id: true, displayName: true } } } } },
    });
    for (const e of t.entries) {
      await this.notifications.push(
        e.userId,
        'tournament.started',
        t.name,
        'Турнир начался. Сетка single-elimination собрана.',
        { tournamentId },
      );
    }
    return updated;
  }

  async reportWinner(tournamentId: string, matchId: string, winnerUserId: string) {
    const t = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!t || t.status !== TournamentStatus.RUNNING) {
      throw new BadRequestException({ code: 'NOT_RUNNING' });
    }
    const bracket = t.bracket as { size: number; matches: BracketMatch[] };
    const match = bracket.matches.find((m) => m.id === matchId);
    if (!match) throw new NotFoundException({ code: 'MATCH_NOT_FOUND' });
    if (match.winner) throw new BadRequestException({ code: 'ALREADY_PLAYED' });
    if (winnerUserId !== match.a && winnerUserId !== match.b) {
      throw new BadRequestException({ code: 'NOT_A_PLAYER' });
    }
    match.winner = winnerUserId;
    const nextRound = match.round + 1;
    const nextSlot = Math.floor(match.slot / 2);
    const next = bracket.matches.find((m) => m.round === nextRound && m.slot === nextSlot);
    if (next) {
      if (match.slot % 2 === 0) next.a = winnerUserId;
      else next.b = winnerUserId;
      if (next.a && !next.b) next.winner = next.a;
      if (!next.a && next.b) next.winner = next.b;
    }
    const finals = bracket.matches.filter((m) => m.round === Math.log2(bracket.size) - 1);
    const done = finals.length > 0 && finals.every((m) => m.winner);
    const status = done ? TournamentStatus.FINISHED : TournamentStatus.RUNNING;
    return this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { bracket, status },
    });
  }

  private buildBracket(userIds: string[]) {
    let size = 2;
    while (size < userIds.length) size *= 2;
    const padded: (string | null)[] = [...userIds];
    while (padded.length < size) padded.push(null);
    const rounds = Math.log2(size);
    const matches: BracketMatch[] = [];
    for (let r = 0; r < rounds; r++) {
      const count = size / 2 ** (r + 1);
      for (let i = 0; i < count; i++) {
        if (r === 0) {
          const a = padded[i * 2];
          const b = padded[i * 2 + 1];
          const winner = a && !b ? a : !a && b ? b : null;
          matches.push({ id: `r0m${i}`, round: 0, slot: i, a, b, winner });
        } else {
          matches.push({ id: `r${r}m${i}`, round: r, slot: i, a: null, b: null, winner: null });
        }
      }
    }
    for (const m of matches.filter((x) => x.round === 0 && x.winner)) {
      const next = matches.find((n) => n.round === 1 && n.slot === Math.floor(m.slot / 2));
      if (!next) continue;
      if (m.slot % 2 === 0) next.a = m.winner;
      else next.b = m.winner;
    }
    return { size, matches };
  }
}
