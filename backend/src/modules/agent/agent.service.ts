import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma, SeatStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { WsEvent } from '../../common/events';
import { AgentPrincipal } from './agent.types';

const PAIR_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const SETTINGS_HOSTS = ['hostsExtra'];
const SETTINGS_POLICY = ['freezeOn', 'freezeEx', 'freezeExReg', 'startupClean'];
const SETTINGS_ENERGY = ['ignoreMonSleep', 'ignorePcSleep'];

@Injectable()
export class AgentService {
  private readonly log = new Logger(AgentService.name);

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
  ) {}

  normalizeCommand(command: string) {
    return String(command ?? '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_');
  }

  async pair(clubId: string, seatId: string) {
    const seat = await this.prisma.seat.findFirst({ where: { id: seatId, clubId } });
    if (!seat) throw new NotFoundException({ code: 'SEAT_NOT_FOUND' });
    const code = this.randomCode(8);
    const pairCodeHash = this.hash(code);
    const pairExpiresAt = new Date(Date.now() + 15 * 60_000);
    await this.prisma.seatAgent.upsert({
      where: { seatId },
      create: { seatId, clubId, pairCodeHash, pairExpiresAt, tokenHash: '' },
      update: { pairCodeHash, pairExpiresAt, clubId },
    });
    return {
      seatId,
      label: seat.label,
      code,
      expiresAt: pairExpiresAt.toISOString(),
      ttlSec: 15 * 60,
    };
  }

  async enroll(dto: { clubId: string; seatId: string; code: string; hostname?: string; version?: string }) {
    const seat = await this.prisma.seat.findFirst({ where: { id: dto.seatId, clubId: dto.clubId } });
    if (!seat) throw new NotFoundException({ code: 'SEAT_NOT_FOUND' });
    const agent = await this.prisma.seatAgent.findUnique({ where: { seatId: dto.seatId } });
    const codeHash = this.hash(String(dto.code ?? '').trim().toUpperCase());
    if (
      !agent ||
      !agent.pairCodeHash ||
      agent.pairCodeHash !== codeHash ||
      !agent.pairExpiresAt ||
      agent.pairExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException({ code: 'PAIR_INVALID' });
    }
    const agentToken = `rda_${crypto.randomBytes(32).toString('hex')}`;
    const now = new Date();
    await this.prisma.seatAgent.update({
      where: { seatId: dto.seatId },
      data: {
        tokenHash: this.hash(agentToken),
        pairCodeHash: '',
        pairExpiresAt: null,
        pairedAt: now,
        lastSeenAt: now,
        hostname: dto.hostname ?? '',
        agentVersion: dto.version ?? '',
      },
    });
    return {
      agentToken,
      clubId: dto.clubId,
      seatId: dto.seatId,
      label: seat.label,
    };
  }

  async heartbeat(
    agent: AgentPrincipal,
    dto: { currentProcess?: string; cpuTemp?: number; version?: string; hostname?: string },
  ) {
    const now = new Date();
    await this.prisma.seatAgent.update({
      where: { id: agent.id },
      data: {
        lastSeenAt: now,
        cpuTemp: dto.cpuTemp ?? undefined,
        agentVersion: dto.version || undefined,
        hostname: dto.hostname || undefined,
      },
    });
    await this.prisma.seatTelemetry.upsert({
      where: { seatId: agent.seatId },
      update: { currentProcess: dto.currentProcess ?? null, lastHeartbeatAt: now },
      create: { seatId: agent.seatId, currentProcess: dto.currentProcess ?? null, lastHeartbeatAt: now },
    });
    const seat = await this.prisma.seat.findUnique({ where: { id: agent.seatId } });
    if (seat?.status === SeatStatus.OFFLINE) {
      await this.prisma.seat.update({ where: { id: seat.id }, data: { status: SeatStatus.FREE } });
    }
    this.realtime.emitToClub(agent.clubId, WsEvent.SeatUpdated, {
      seatId: agent.seatId,
      currentProcess: dto.currentProcess ?? null,
      lastHeartbeatAt: now.toISOString(),
      agentLastSeenAt: now.toISOString(),
      hostname: dto.hostname ?? agent.hostname,
      agentVersion: dto.version ?? agent.agentVersion,
      status: seat?.status === SeatStatus.OFFLINE ? SeatStatus.FREE : seat?.status,
    });
    return { ok: true, serverTime: now.toISOString() };
  }

  async consume(agent: AgentPrincipal) {
    return this.prisma.$transaction(async (tx) => {
      const queued = await tx.agentCommand.findMany({
        where: {
          clubId: agent.clubId,
          status: 'QUEUED',
          OR: [{ seatId: agent.seatId }, { seatId: null }],
        },
        orderBy: { createdAt: 'asc' },
        take: 8,
      });
      const taken: typeof queued = [];
      for (const row of queued) {
        const upd = await tx.agentCommand.updateMany({
          where: { id: row.id, status: 'QUEUED' },
          data: { status: 'RUNNING' },
        });
        if (upd.count) taken.push({ ...row, status: 'RUNNING' });
      }
      return taken;
    });
  }

  async ack(agent: AgentPrincipal, id: string, status: 'DONE' | 'FAILED', result = '') {
    const row = await this.prisma.agentCommand.findFirst({
      where: {
        id,
        clubId: agent.clubId,
        OR: [{ seatId: agent.seatId }, { seatId: null }],
      },
    });
    if (!row) throw new NotFoundException({ code: 'COMMAND_NOT_FOUND' });
    if (row.status === 'DONE' || row.status === 'FAILED') return row;
    return this.prisma.agentCommand.update({
      where: { id },
      data: { status, result: result.slice(0, 4000), ackedAt: new Date() },
    });
  }

  updateChannel(channel = 'stable') {
    const ch = channel === 'beta' ? 'beta' : 'stable';
    const prefix = ch === 'beta' ? 'AGENT_UPDATE_BETA' : 'AGENT_UPDATE';
    return {
      channel: ch,
      version: process.env[`${prefix}_VERSION`] ?? process.env.AGENT_UPDATE_VERSION ?? '1.0.0',
      url: process.env[`${prefix}_URL`] ?? process.env.AGENT_UPDATE_URL ?? '',
      sha256: process.env[`${prefix}_SHA256`] ?? process.env.AGENT_UPDATE_SHA256 ?? '',
      notes: process.env[`${prefix}_NOTES`] ?? process.env.AGENT_UPDATE_NOTES ?? '',
    };
  }

  async enqueue(
    clubId: string,
    command: string,
    seatId?: string | null,
    payload: Prisma.InputJsonValue = {},
  ) {
    const cmd = this.normalizeCommand(command);
    if (!cmd) throw new BadRequestException({ code: 'COMMAND_REQUIRED' });
    if (seatId) {
      return this.prisma.agentCommand.create({
        data: { clubId, command: cmd, seatId, payload, status: 'QUEUED' },
      });
    }
    const seats = await this.prisma.seat.findMany({ where: { clubId }, select: { id: true } });
    if (!seats.length) {
      return this.prisma.agentCommand.create({
        data: { clubId, command: cmd, payload, status: 'QUEUED' },
      });
    }
    await this.prisma.agentCommand.createMany({
      data: seats.map((s) => ({ clubId, seatId: s.id, command: cmd, payload, status: 'QUEUED' })),
    });
    return { ok: true, command: cmd, seats: seats.length };
  }

  async dispatchPc(clubId: string, seatId: string, command: string) {
    const cmd = this.normalizeCommand(command);
    const payload = { seatId, command: cmd, at: new Date().toISOString() };
    this.realtime.emitToSeat(seatId, WsEvent.PcCommand, payload);
    this.realtime.emitToClub(clubId, WsEvent.PcCommand, payload);
    await this.enqueue(clubId, cmd, seatId);
    return payload;
  }

  async onSettingsChanged(clubId: string, patch: Record<string, unknown>) {
    const keys = Object.keys(patch);
    const settings = await this.clubSettings(clubId);
    const jobs: Array<{ command: string; payload: Prisma.InputJsonValue }> = [];
    if (keys.some((k) => SETTINGS_HOSTS.includes(k))) {
      jobs.push({ command: 'SYNC_HOSTS', payload: { hostsExtra: settings.hostsExtra ?? '' } });
    }
    if (keys.some((k) => SETTINGS_POLICY.includes(k))) {
      jobs.push({
        command: 'APPLY_POLICY',
        payload: {
          freezeOn: settings.freezeOn ?? false,
          freezeEx: settings.freezeEx ?? '',
          freezeExReg: settings.freezeExReg ?? '',
          startupClean: settings.startupClean ?? '',
        },
      });
      if (keys.includes('startupClean')) {
        jobs.push({ command: 'STARTUP_CLEAN', payload: { startupClean: settings.startupClean ?? '' } });
      }
    }
    if (keys.some((k) => SETTINGS_ENERGY.includes(k))) {
      jobs.push({
        command: 'ENERGY',
        payload: {
          ignoreMonSleep: settings.ignoreMonSleep ?? false,
          ignorePcSleep: settings.ignorePcSleep ?? false,
        },
      });
    }
    for (const job of jobs) await this.enqueue(clubId, job.command, null, job.payload);
    return jobs.map((j) => j.command);
  }

  async listCommands(clubId: string) {
    return this.prisma.agentCommand.findMany({
      where: { clubId },
      include: { seat: { select: { id: true, label: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Interval(30_000)
  async markStaleOffline() {
    if (process.env.DISABLE_TICKER === '1') return;
    try {
      const agents = await this.prisma.seatAgent.findMany({
        where: { tokenHash: { not: '' } },
        include: { seat: true, club: { select: { id: true, settings: true } } },
      });
      const now = Date.now();
      for (const agent of agents) {
        const settings = (agent.club.settings as Record<string, unknown>) ?? {};
        const windowSec = Number(settings.offlineMinutes ?? 120) || 120;
        const seen = agent.lastSeenAt ?? agent.pairedAt;
        if (!seen || now - seen.getTime() < windowSec * 1000) continue;
        if (
          agent.seat.status === SeatStatus.OCCUPIED ||
          agent.seat.status === SeatStatus.MAINTENANCE ||
          agent.seat.status === SeatStatus.RESERVED
        ) {
          continue;
        }
        if (agent.seat.status === SeatStatus.OFFLINE) continue;
        await this.prisma.seat.update({
          where: { id: agent.seatId },
          data: { status: SeatStatus.OFFLINE },
        });
        this.realtime.emitToClub(agent.clubId, WsEvent.SeatUpdated, {
          seatId: agent.seatId,
          status: SeatStatus.OFFLINE,
        });
      }
    } catch (e) {
      this.log.warn(`offline job: ${(e as Error).message}`);
    }
  }

  private async clubSettings(clubId: string) {
    const club = await this.prisma.club.findUnique({ where: { id: clubId }, select: { settings: true } });
    return ((club?.settings as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  }

  private hash(value: string) {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private randomCode(len: number) {
    const bytes = crypto.randomBytes(len);
    let out = '';
    for (let i = 0; i < len; i++) out += PAIR_ALPHABET[bytes[i] % PAIR_ALPHABET.length];
    return out;
  }
}
