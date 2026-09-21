"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatByn } from "@/lib/money";
import { Btn, translate } from "./hall-tab";
import { BookingGrid, timeOptions } from "./booking-grid";

const STATUS: Record<string, string> = {
  PENDING: "ожидает",
  CONFIRMED: "подтверждена",
  CANCELLED: "отменена",
  COMPLETED: "гость пришёл",
  NO_SHOW: "не пришёл",
};

function addMinutes(date: string, time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

export function BookingsTab({ clubId, club }: { clubId: string; club: any }) {
  const [rows, setRows] = useState<any[]>([]);
  const [all, setAll] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [guestQuery, setGuestQuery] = useState("");
  const [guests, setGuests] = useState<any[]>([]);
  const times = timeOptions();
  const [form, setForm] = useState({
    userId: "",
    guestName: "",
    guestPhone: "",
    seatId: "",
    tariffId: club?.tariffs?.[0]?.id ?? "",
    date: "",
    start: "18:00",
    end: "20:00",
  });

  const seats = club?.zones?.flatMap((z: any) => z.seats.map((s: any) => ({ ...s, zone: z.name }))) ?? [];

  async function load() {
    setRows(await api(`/api/v1/clubs/${clubId}/bookings${all ? "?all=1" : ""}`));
  }
  useEffect(() => {
    load().catch((e) => setMsg(translate(e.message)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, all]);

  useEffect(() => {
    if (guestQuery.length < 2) return;
    const t = setTimeout(() => {
      api<any[]>(`/api/v1/clubs/${clubId}/guests?q=${encodeURIComponent(guestQuery)}`).then(setGuests).catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [guestQuery, clubId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/\s+/g, "");
    if (!q) return rows;
    return rows.filter((b) =>
      [b.guestName, b.guestPhone, b.user?.displayName, b.user?.phone, b.seat?.label, STATUS[b.status]]
        .join(" ")
        .toLowerCase()
        .replace(/\s+/g, "")
        .includes(q),
    );
  }, [rows, search]);

  async function act(label: string, fn: () => Promise<unknown>) {
    setMsg("");
    try {
      await fn();
      setMsg(label);
      await load();
    } catch (e: any) {
      setMsg(translate(e.message));
    }
  }

  async function create() {
    const starts = addMinutes(form.date, form.start, 0);
    const ends = addMinutes(form.date, form.end, 0);
    if (ends <= starts) {
      setMsg("Конец должен быть позже начала");
      return;
    }
    await act("Бронь создана", () =>
      api(`/api/v1/clubs/${clubId}/bookings`, {
        method: "POST",
        body: JSON.stringify({
          userId: form.userId || undefined,
          guestName: form.guestName || undefined,
          guestPhone: form.guestPhone || undefined,
          seatId: form.seatId,
          tariffId: form.tariffId,
          startsAt: starts.toISOString(),
          endsAt: ends.toISOString(),
        }),
      }),
    );
  }

  const field = "mt-1 min-h-11 w-full rounded-[3px] bg-void px-3 text-fog";

  return (
    <div className="space-y-8">
      <label className="block">
        <span className="sr-only">Поиск брони</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-12 w-full rounded-[4px] bg-velvet px-4 text-fog"
          placeholder="Телефон, имя или номер ПК"
        />
      </label>
      <BookingGrid
        clubId={clubId}
        club={club}
        query={search}
        onPick={(p) => setForm((f) => ({ ...f, seatId: p.seatId, date: p.date, start: p.start, end: p.end }))}
      />
      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl text-paper">{all ? "Все брони за 7 дней" : "Активные брони"}</h3>
            <button type="button" onClick={() => setAll(!all)} className="text-sm text-coral">
              {all ? "Только активные" : "Показать историю"}
            </button>
          </div>
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-mute">
              <tr>
                <th className="py-2 font-normal">Когда</th>
                <th className="py-2 font-normal">ПК</th>
                <th className="py-2 font-normal">Гость</th>
                <th className="py-2 font-normal">Статус</th>
                <th className="py-2 font-normal"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filtered.map((b) => {
                const active = b.status === "CONFIRMED" || b.status === "PENDING";
                return (
                  <tr key={b.id}>
                    <td className="py-3 text-fog">
                      {new Date(b.startsAt).toLocaleString("ru-BY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      <span className="text-mute"> — {new Date(b.endsAt).toLocaleTimeString("ru-BY", { hour: "2-digit", minute: "2-digit" })}</span>
                    </td>
                    <td className="py-3 text-paper">{b.seat?.label}</td>
                    <td className="py-3 text-fog">
                      {b.guestName || b.user?.displayName}
                      <div className="text-xs text-mute">{b.guestPhone || b.user?.phone || "без телефона"}</div>
                    </td>
                    <td className="py-3 text-fog">{STATUS[b.status] ?? b.status}</td>
                    <td className="py-3 text-right">
                      {active && (
                        <div className="flex justify-end gap-2">
                          <button type="button" className="text-coral" onClick={() => act("Гость посажен, сессия запущена", () => api(`/api/v1/bookings/${b.id}/arrive`, { method: "POST", body: "{}" }))}>
                            Пришёл
                          </button>
                          <button type="button" className="text-mute hover:text-busy" onClick={() => act("Бронь отменена", () => api(`/api/v1/bookings/${b.id}/cancel`, { method: "POST", body: "{}" }))}>
                            Отменить
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-mute">
                    Броней нет.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <aside className="rounded-[6px] bg-velvet p-5">
          <h3 className="font-display text-xl text-paper">Новая бронь</h3>
          <p className="mt-1 text-xs text-mute">Можно выбрать гостя из базы или записать walk-in: имя обязательно, телефон нет.</p>
          <label className="mt-4 block text-sm text-mute" htmlFor="bn">
            Имя
          </label>
          <input
            id="bn"
            value={form.guestName}
            onChange={(e) => setForm({ ...form, guestName: e.target.value, userId: "" })}
            className={field}
            placeholder="Никита, тест…"
          />
          <label className="mt-3 block text-sm text-mute" htmlFor="bp">
            Телефон (необязательно)
          </label>
          <input
            id="bp"
            value={form.guestPhone}
            onChange={(e) => setForm({ ...form, guestPhone: e.target.value, userId: "" })}
            className={field}
            placeholder="+375…"
          />
          <label className="mt-3 block text-sm text-mute" htmlFor="bg">
            Или найти в базе
          </label>
          <input id="bg" value={guestQuery} onChange={(e) => setGuestQuery(e.target.value)} className={field} placeholder="телефон или имя" />
          {guests.length > 0 && guestQuery.length >= 2 && (
            <ul className="mt-1 max-h-40 overflow-auto rounded-[3px] bg-void text-sm">
              {guests.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    className="flex w-full justify-between px-3 py-2 text-left hover:bg-velvet"
                    onClick={() => {
                      setForm({ ...form, userId: g.id, guestName: g.displayName, guestPhone: g.phone ?? "" });
                      setGuestQuery(`${g.displayName} · ${g.phone || "без телефона"}`);
                      setGuests([]);
                    }}
                  >
                    <span className="text-fog">
                      {g.displayName} · {g.phone || "без телефона"}
                    </span>
                    <span className="text-coral">{formatByn(g.balanceKopecks)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="mt-3 block text-sm text-mute" htmlFor="bs">
            ПК
          </label>
          <select id="bs" value={form.seatId} onChange={(e) => setForm({ ...form, seatId: e.target.value })} className={field}>
            <option value="">Выберите</option>
            {seats.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.zone} · {s.label}
              </option>
            ))}
          </select>
          <label className="mt-3 block text-sm text-mute" htmlFor="bt">
            Тариф
          </label>
          <select id="bt" value={form.tariffId} onChange={(e) => setForm({ ...form, tariffId: e.target.value })} className={field}>
            {club?.tariffs?.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name} · {formatByn(t.pricePerHourKopecks)}/ч
              </option>
            ))}
          </select>
          <label className="mt-3 block text-sm text-mute" htmlFor="bd">
            Дата
          </label>
          <input id="bd" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={field} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-mute" htmlFor="bh">
                С
              </label>
              <select id="bh" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className={field}>
                {times.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-mute" htmlFor="be">
                До
              </label>
              <select id="be" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className={field}>
                {times.map((t) => (
                  <option key={`e-${t}`} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <Btn tone="primary" disabled={(!form.userId && !form.guestName.trim()) || !form.seatId || !form.date} onClick={create}>
              Создать бронь
            </Btn>
          </div>
          {msg && (
            <p className="mt-4 text-sm text-coral" role="status">
              {msg}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
