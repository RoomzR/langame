"use client";

import { useEffect, useMemo, useState } from "react";
import { API, api, token } from "@/lib/api";
import { formatByn } from "@/lib/money";
import { ErrorBanner, SuccessMark } from "@/components/hud-states";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export type AvailabilitySeat = { id: string; label: string; available: boolean; zoneId: string };

export function BookingDesk({
  club,
  selectedSeatId,
  onAvailability,
}: {
  club: any;
  selectedSeatId?: string;
  onAvailability?: (seats: AvailabilitySeat[]) => void;
}) {
  const seats = club.zones?.flatMap((z: any) => z.seats.map((s: any) => ({ ...s, zone: z.name }))) ?? [];
  const tariffs = club.tariffs ?? [];
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  const [seatId, setSeatId] = useState(selectedSeatId ?? seats.find((s: any) => s.status === "FREE")?.id ?? seats[0]?.id ?? "");
  const [tariffId, setTariffId] = useState(tariffs[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [hour, setHour] = useState(String(Math.min(23, Math.max(10, new Date().getHours() + 1))));
  const [hours, setHours] = useState(1);
  const [rulesOk, setRulesOk] = useState(false);
  const [avail, setAvail] = useState<AvailabilitySeat[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (selectedSeatId) setSeatId(selectedSeatId);
  }, [selectedSeatId]);

  const starts = useMemo(() => new Date(`${date}T${pad(Number(hour))}:00:00`), [date, hour]);
  const ends = useMemo(() => new Date(starts.getTime() + hours * 3600_000), [starts, hours]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`${API}/api/v1/clubs/${club.id}/availability?from=${starts.toISOString()}&to=${ends.toISOString()}`, {
      signal: ctrl.signal,
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: AvailabilitySeat[]) => {
        setAvail(list);
        onAvailability?.(list);
      })
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [club.id, starts, ends, onAvailability]);

  const tariff = tariffs.find((t: any) => t.id === tariffId);
  const seatMeta = seats.find((s: any) => s.id === seatId);
  const zoneTariff = tariffs.find((t: any) => t.zoneId && t.zoneId === seatMeta?.zoneId);
  useEffect(() => {
    if (zoneTariff) setTariffId(zoneTariff.id);
  }, [zoneTariff?.id]);
  const price = tariff ? tariff.pricePerHourKopecks * hours : 0;
  const seatFree = avail.find((a) => a.id === seatId)?.available ?? true;
  const freeCount = avail.length ? avail.filter((a) => a.available).length : seats.filter((s: any) => s.status === "FREE").length;

  async function book() {
    setMsg(null);
    if (!token()) {
      setMsg({ kind: "err", text: "Войдите. Бронь с аккаунта" });
      return;
    }
    if (!rulesOk) {
      setMsg({ kind: "err", text: "Правила брони. Подтвердить" });
      return;
    }
    setBusy(true);
    try {
      await api(`/api/v1/clubs/${club.id}/bookings`, {
        method: "POST",
        body: JSON.stringify({ seatId, tariffId, startsAt: starts.toISOString(), endsAt: ends.toISOString() }),
      });
      setMsg({
        kind: "ok",
        text: `Бронь активна. ${starts.toLocaleTimeString("ru-BY", { hour: "2-digit", minute: "2-digit" })}–${ends.toLocaleTimeString("ru-BY", { hour: "2-digit", minute: "2-digit" })}`,
      });
    } catch (e: any) {
      const m = String(e.message);
      setMsg({
        kind: "err",
        text:
          m === "SLOT_TAKEN"
            ? "Слот занят. Другой ПК"
            : m === "UNAUTHORIZED"
              ? "Сессия истекла. Войти"
              : "Связь потеряна. Повторить",
      });
    } finally {
      setBusy(false);
    }
  }

  const chip = (on: boolean) =>
    `min-h-11 rounded-md text-sm font-semibold transition-colors ${on ? "bg-accent text-ink" : "bg-white/5 text-dim hover:bg-white/10"}`;

  return (
    <aside id="book" className={`panel-hud scroll-mt-24 p-6 xl:sticky xl:top-24 xl:self-start ${msg?.kind === "ok" ? "success-flash" : ""}`}>
      <div className="flex items-end justify-between gap-4">
        <h2 className="display text-[40px] text-ink">Бронь</h2>
        <p className="display text-[40px] text-coral">{formatByn(price)}</p>
      </div>
      <p className="mono mt-1 text-xs uppercase text-dim">
        {hours} ч · свободно {freeCount} из {seats.length}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-dim" htmlFor="date">
            Дата
          </label>
          <input id="date" type="date" min={today} className="field-hud mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-dim" htmlFor="hour">
            Начало
          </label>
          <select id="hour" className="field-hud mt-1" value={hour} onChange={(e) => setHour(e.target.value)}>
            {Array.from({ length: 14 }).map((_, i) => {
              const h = i + 10;
              return (
                <option key={h} value={String(h)}>
                  {pad(h)}:00
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <label className="mt-4 block text-sm text-dim" htmlFor="hours">
        Длительность
      </label>
      <div className="mt-1 grid grid-cols-5 gap-1">
        {[1, 2, 3, 4, 5].map((h) => (
          <button key={h} type="button" onClick={() => setHours(h)} className={chip(hours === h)}>
            {h} ч
          </button>
        ))}
      </div>

      <label className="mt-4 block text-sm text-dim" htmlFor="seat">
        Место
      </label>
      <select id="seat" className="field-hud mt-1" value={seatId} onChange={(e) => setSeatId(e.target.value)}>
        {seats.map((s: any) => {
          const a = avail.find((x) => x.id === s.id);
          const free = a ? a.available : s.status === "FREE";
          return (
            <option key={s.id} value={s.id}>
              {s.zone} · {s.label} · {free ? "свободно" : "занято"}
            </option>
          );
        })}
      </select>
      {!seatFree && <p className="mt-1 text-sm text-coral">Слот занят. Другой ПК</p>}

      <label className="mt-4 block text-sm text-dim" htmlFor="tariff">
        Тариф
      </label>
      <select id="tariff" className="field-hud mt-1" value={tariffId} onChange={(e) => setTariffId(e.target.value)}>
        {tariffs.map((t: any) => (
          <option key={t.id} value={t.id}>
            {t.name} · {formatByn(t.pricePerHourKopecks)}/ч
          </option>
        ))}
      </select>

      <details className="mt-5 rounded-md bg-white/5 p-3 text-sm text-dim">
        <summary className="cursor-pointer text-ink">Правила брони</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Место держится 15 минут после начала слота, затем бронь снимается.</li>
          <li>Списание идёт с баланса по ходу сессии, а не заранее.</li>
          <li>Отменить бронь можно в кабинете до начала слота.</li>
          <li>При нехватке средств сессия не стартует — пополните баланс заранее.</li>
        </ul>
      </details>
      <label className="mt-3 flex items-start gap-2 text-sm text-dim">
        <input type="checkbox" className="hud-check mt-1" checked={rulesOk} onChange={(e) => setRulesOk(e.target.checked)} />
        Я прочитал правила брони и согласен
      </label>

      <button type="button" disabled={busy || !seatId || !seatFree} onClick={book} className="btn-hud mt-5 w-full">
        Бронь
      </button>
      {msg?.kind === "ok" && (
        <div className="mt-3">
          <SuccessMark text={msg.text} />
        </div>
      )}
      {msg?.kind === "err" && (
        <div className="mt-3">
          <ErrorBanner text={msg.text} onRetry={msg.text.startsWith("Связь") ? book : undefined} />
        </div>
      )}
    </aside>
  );
}
