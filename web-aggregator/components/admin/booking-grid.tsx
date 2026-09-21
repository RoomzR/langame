"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";

const SLOT = 30;
const COL_W = 36;
const START_H = 12;
const SLOTS = 46;

export type SlotPick = {
  seatId: string;
  date: string;
  start: string;
  end: string;
};

function dayStart(d: Date) {
  const x = new Date(d);
  x.setHours(START_H, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function hhmm(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function slotIndex(date: Date, origin: Date) {
  return Math.round((date.getTime() - origin.getTime()) / (SLOT * 60_000));
}

function matches(q: string, ...parts: Array<string | null | undefined>) {
  if (!q.trim()) return false;
  const n = q.trim().toLowerCase().replace(/\s+/g, "");
  return parts.some((p) => (p ?? "").toLowerCase().replace(/\s+/g, "").includes(n));
}

type Seat = { id: string; label: string; zone: string; color?: string; status: string; guestName?: string | null; remainingSeconds?: number | null };
type Booking = { id: string; seatId: string; startsAt: string; endsAt: string; status: string; user?: { displayName: string; phone?: string } };

export function BookingGrid({
  clubId,
  club,
  onPick,
  query = "",
}: {
  clubId: string;
  club: any;
  onPick: (p: SlotPick) => void;
  query?: string;
}) {
  const [day, setDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [rows, setRows] = useState<Booking[]>([]);
  const [live, setLive] = useState<any[]>([]);
  const [drag, setDrag] = useState<{ seatId: string; a: number; b: number } | null>(null);
  const trackRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const seats: Seat[] = useMemo(() => {
    const fromClub =
      club?.zones?.flatMap((z: any) =>
        z.seats.map((s: any) => ({ id: s.id, label: s.label, zone: z.name, color: z.color, status: s.status })),
      ) ?? [];
    return fromClub.map((s: Seat) => {
      const l = live.find((x) => x.id === s.id);
      return { ...s, status: l?.status ?? s.status, guestName: l?.guestName, remainingSeconds: l?.remainingSeconds };
    });
  }, [club, live]);

  async function load() {
    const [b, map] = await Promise.all([
      api<Booking[]>(`/api/v1/clubs/${clubId}/bookings?all=1`),
      api<any[]>(`/api/v1/clubs/${clubId}/seat-map`).catch(() => []),
    ]);
    setRows(b);
    setLive(map);
  }

  useEffect(() => {
    load().catch(() => undefined);
    const t = setInterval(() => load().catch(() => undefined), 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  const origin = dayStart(day);
  const end = new Date(origin.getTime() + SLOTS * SLOT * 60_000);
  const hours = Array.from({ length: SLOTS }, (_, i) => new Date(origin.getTime() + i * SLOT * 60_000));
  const nowLine = slotIndex(new Date(), origin);

  function colFromEvent(seatId: string, clientX: number) {
    const el = trackRefs.current[seatId];
    if (!el) return 0;
    const x = clientX - el.getBoundingClientRect().left;
    return Math.max(0, Math.min(SLOTS - 1, Math.floor(x / COL_W)));
  }

  function commit(seatId: string, a: number, b: number) {
    const from = Math.min(a, b);
    const to = Math.max(a, b);
    const startT = hours[from];
    const endT = new Date(hours[to].getTime() + SLOT * 60_000);
    onPick({
      seatId,
      date: `${startT.getFullYear()}-${pad(startT.getMonth() + 1)}-${pad(startT.getDate())}`,
      start: hhmm(startT),
      end: hhmm(endT),
    });
  }

  function onPointerDown(seatId: string, e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("[data-booking]")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const col = colFromEvent(seatId, e.clientX);
    setDrag({ seatId, a: col, b: col });
  }

  function onPointerMove(seatId: string, e: React.PointerEvent) {
    if (!drag || drag.seatId !== seatId) return;
    setDrag({ ...drag, b: colFromEvent(seatId, e.clientX) });
  }

  function onPointerUp(seatId: string, e: React.PointerEvent) {
    if (!drag || drag.seatId !== seatId) return;
    const b = colFromEvent(seatId, e.clientX);
    commit(seatId, drag.a, b);
    setDrag(null);
  }

  return (
    <div className="glass overflow-hidden rounded-xl">
      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-line px-4 py-3">
        <button type="button" className="rounded-md bg-white/5 px-3 py-1.5 text-sm" onClick={() => setDay(addDays(new Date(), -1))}>
          Вчера
        </button>
        <button type="button" className="text-dim" onClick={() => setDay(addDays(day, -1))} aria-label="Назад">
          ‹
        </button>
        <span className="display text-xl text-ink">{day.toLocaleDateString("ru-BY")}</span>
        <button type="button" className="text-dim" onClick={() => setDay(addDays(day, 1))} aria-label="Вперёд">
          ›
        </button>
        <button type="button" className="rounded-md bg-white/5 px-3 py-1.5 text-sm" onClick={() => setDay(new Date())}>
          Сегодня
        </button>
      </div>

      <div className="overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
        <div className="relative min-w-max">
          <div className="sticky top-0 z-10 flex border-b border-line bg-base text-[10px] text-dim">
            <div className="sticky left-0 z-20 w-14 shrink-0 bg-base" />
            {hours.map((t, i) => (
              <div key={i} className="shrink-0 border-l border-line/60 text-center" style={{ width: COL_W }}>
                {t.getMinutes() === 0 ? `${pad(t.getHours())}:00` : ""}
              </div>
            ))}
          </div>

          {seats.map((s) => {
            const dayBookings = rows.filter(
              (b) => b.seatId === s.id && ["PENDING", "CONFIRMED"].includes(b.status) && new Date(b.startsAt) < end && new Date(b.endsAt) > origin,
            );
            const hit = matches(query, s.label, s.guestName, ...dayBookings.flatMap((b) => [b.user?.displayName, b.user?.phone]));
            const sel = drag?.seatId === s.id ? { from: Math.min(drag.a, drag.b), to: Math.max(drag.a, drag.b) } : null;
            return (
              <div key={s.id} className={`relative flex h-11 border-b border-line/70 ${query && hit ? "bg-white/5" : query ? "opacity-40" : ""}`}>
                <div
                  className="sticky left-0 z-10 flex w-14 shrink-0 items-center justify-center text-xs font-bold text-ink"
                  style={{ background: s.color || "#2015FF" }}
                >
                  {s.label.replace(/[^\d]/g, "") || s.label}
                </div>
                <div
                  ref={(el) => {
                    trackRefs.current[s.id] = el;
                  }}
                  className="relative cursor-ew-resize touch-none"
                  style={{ width: SLOTS * COL_W }}
                  onPointerDown={(e) => onPointerDown(s.id, e)}
                  onPointerMove={(e) => onPointerMove(s.id, e)}
                  onPointerUp={(e) => onPointerUp(s.id, e)}
                >
                  {hours.map((_, i) => (
                    <div key={i} className="pointer-events-none absolute top-0 h-full border-l border-white/5" style={{ left: i * COL_W, width: COL_W }} />
                  ))}
                  {sel && (
                    <div
                      className="pointer-events-none absolute top-0.5 h-[calc(100%-4px)] rounded-sm bg-white/35"
                      style={{ left: sel.from * COL_W, width: Math.max(COL_W, (sel.to - sel.from + 1) * COL_W) }}
                    />
                  )}
                  {s.status === "OCCUPIED" && nowLine >= 0 && nowLine < SLOTS && (
                    <div
                      className="pointer-events-none absolute top-0.5 h-[calc(100%-4px)] overflow-hidden"
                      style={{
                        left: Math.max(0, nowLine) * COL_W,
                        width: Math.max(COL_W, Math.round(((s.remainingSeconds ?? 1800) / 60 / SLOT) * COL_W)),
                        backgroundImage:
                          "repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(0,0,0,.45) 5px, rgba(0,0,0,.45) 8px)",
                        backgroundColor: "rgba(32,21,255,.18)",
                      }}
                      title={s.guestName ?? "занято"}
                    />
                  )}
                  {dayBookings.map((b) => {
                    const a = Math.max(0, slotIndex(new Date(b.startsAt), origin));
                    const z = Math.min(SLOTS, slotIndex(new Date(b.endsAt), origin));
                    if (z <= 0 || a >= SLOTS) return null;
                    const mark = matches(query, b.user?.displayName, b.user?.phone);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        data-booking
                        className={`absolute top-1 z-10 flex h-8 items-center overflow-hidden rounded-sm px-2 text-left text-xs font-semibold ${
                          mark ? "bg-coral text-ink" : "bg-white text-night"
                        }`}
                        style={{ left: a * COL_W + 2, width: Math.max(COL_W - 4, (z - a) * COL_W - 4) }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPick({
                            seatId: s.id,
                            date: `${new Date(b.startsAt).getFullYear()}-${pad(new Date(b.startsAt).getMonth() + 1)}-${pad(new Date(b.startsAt).getDate())}`,
                            start: hhmm(new Date(b.startsAt)),
                            end: hhmm(new Date(b.endsAt)),
                          });
                        }}
                      >
                        {b.user?.displayName}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {nowLine >= 0 && nowLine <= SLOTS && (
            <div className="pointer-events-none absolute top-6 bottom-0 w-px bg-coral" style={{ left: 56 + nowLine * COL_W }} />
          )}
        </div>
      </div>
      <p className="px-4 py-2 text-xs text-dim">Зажмите и протяните по пустым ячейкам — в форму попадёт весь интервал. Кресты — текущая сессия.</p>
    </div>
  );
}

export function timeOptions() {
  const out: string[] = [];
  for (let h = 10; h <= 23; h++) {
    out.push(`${pad(h)}:00`, `${pad(h)}:30`);
  }
  out.push("00:00");
  return out;
}
