"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatByn } from "@/lib/money";

type SeatRow = {
  id: string;
  label: string;
  zoneName: string;
  status: string;
  guestName: string | null;
  remainingSeconds: number | null;
  balanceKopecks: number | null;
  sessionId: string | null;
  sessionStatus: string | null;
  currentProcess: string | null;
  lastHeartbeatAt: string | null;
  agentLastSeenAt: string | null;
  agentVersion: string | null;
  hostname: string | null;
  agentPaired: boolean;
};

const STATUS_RU: Record<string, string> = {
  FREE: "свободен",
  OCCUPIED: "занят",
  RESERVED: "бронь",
  MAINTENANCE: "сервис",
  OFFLINE: "офлайн",
};

const TILE: Record<string, string> = {
  FREE: "bg-accent/30 text-ink shadow-[inset_0_0_0_2px_#2015FF]",
  OCCUPIED: "bg-coral/20 text-coral shadow-[inset_0_0_0_1.5px_#FF6A3D]",
  RESERVED: "bg-accent/10 text-accent shadow-[inset_0_0_0_1.5px_#2015FF]",
  MAINTENANCE: "bg-elevated text-dim shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]",
  OFFLINE: "bg-elevated text-dim shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]",
};

function hms(sec: number | null) {
  if (sec == null) return "по балансу";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function HallTab({ clubId, club }: { clubId: string; club: any }) {
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [selected, setSelected] = useState<SeatRow | null>(null);
  const [guestQuery, setGuestQuery] = useState("");
  const [hallSearch, setHallSearch] = useState("");
  const [guests, setGuests] = useState<any[]>([]);
  const [guestId, setGuestId] = useState("");
  const [tariffId, setTariffId] = useState(club?.tariffs?.[0]?.id ?? "");
  const [mode, setMode] = useState<"WALLET" | "PREPAID">("WALLET");
  const [prepaid, setPrepaid] = useState(60);
  const [minutes, setMinutes] = useState(30);
  const [msg, setMsg] = useState("");
  const [bulk, setBulk] = useState<Set<string>>(new Set());
  const [pairCode, setPairCode] = useState("");

  async function refresh() {
    const list = await api<SeatRow[]>(`/api/v1/clubs/${clubId}/seat-map`);
    setSeats(list);
    if (selected) setSelected(list.find((s) => s.id === selected.id) ?? null);
  }

  useEffect(() => {
    refresh().catch((e) => setMsg(e.message));
    const t = setInterval(() => refresh().catch(() => undefined), 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  useEffect(() => {
    if (guestQuery.length < 2) return;
    const t = setTimeout(() => {
      api<any[]>(`/api/v1/clubs/${clubId}/guests?q=${encodeURIComponent(guestQuery)}`)
        .then(setGuests)
        .catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [guestQuery, clubId]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setMsg("");
    try {
      await fn();
      setMsg(label);
      await refresh();
    } catch (e: any) {
      setMsg(translate(e.message));
    }
  }

  const post = (path: string, body: unknown = {}) => api(path, { method: "POST", body: JSON.stringify(body) });

  function toggleBulk(id: string) {
    const next = new Set(bulk);
    next.has(id) ? next.delete(id) : next.add(id);
    setBulk(next);
  }

  async function bulkCommand(command: string) {
    await run(`${command} отправлена на ${bulk.size} ПК`, async () => {
      for (const id of bulk) await post(`/api/v1/clubs/${clubId}/seats/${id}/command`, { command });
    });
    setBulk(new Set());
  }

  const zones = Array.from(new Set(seats.map((s) => s.zoneName)));

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-mute">
            Занято {seats.filter((s) => s.status === "OCCUPIED").length} из {seats.length}. Обновляется каждые 8 секунд.
          </p>
          <input
            value={hallSearch}
            onChange={(e) => setHallSearch(e.target.value)}
            placeholder="Найти ПК по телефону или имени"
            className="min-h-11 min-w-[220px] flex-1 rounded-[4px] bg-velvet px-3 text-sm text-fog"
            aria-label="Поиск по залу"
          />
          {bulk.size > 0 && (
            <div className="flex gap-2 text-sm">
              <span className="text-fog">Выбрано {bulk.size}:</span>
              {["LOCK", "UNLOCK", "REBOOT"].map((c) => (
                <button key={c} type="button" onClick={() => bulkCommand(c)} className="rounded-[3px] bg-velvet px-3 py-1 text-fog">
                  {c === "LOCK" ? "Заблокировать" : c === "UNLOCK" ? "Разблокировать" : "Перезагрузить"}
                </button>
              ))}
              <button type="button" onClick={() => setBulk(new Set())} className="text-mute">
                Снять
              </button>
            </div>
          )}
        </div>
        {zones.map((z) => (
          <section key={z} className="mt-6">
            <h3 className="mono text-xs uppercase text-dim">{z}</h3>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {seats
                .filter((s) => s.zoneName === z)
                .filter((s) => {
                  const q = hallSearch.trim().toLowerCase();
                  if (!q) return true;
                  return [s.label, s.guestName, s.zoneName].join(" ").toLowerCase().includes(q);
                })
                .map((s) => {
                  const occupied = s.status === "OCCUPIED";
                  return (
                    <div
                      key={s.id}
                      className={`relative flex min-h-[168px] flex-col justify-between rounded-xl p-3 ${
                        occupied ? "bg-[#1a1210] shadow-[inset_0_0_0_1.5px_#FF6A3D]" : TILE[s.status] ?? TILE.FREE
                      } ${selected?.id === s.id ? "ring-2 ring-white" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button type="button" onClick={() => setSelected(s)} className="text-left">
                          <span className="display text-[36px] leading-none text-ink">{s.label.replace(/[^\d]/g, "") || s.label}</span>
                          <span className={`ml-2 text-[11px] font-semibold ${occupied ? "text-coral" : "text-white/70"}`}>
                            {STATUS_RU[s.status] ?? s.status}
                          </span>
                        </button>
                        <input type="checkbox" className="hud-check" checked={bulk.has(s.id)} onChange={() => toggleBulk(s.id)} aria-label={`Выбрать ${s.label}`} />
                      </div>
                      {occupied && (
                        <button
                          type="button"
                          className="mt-2 min-h-9 rounded-md bg-coral text-sm font-bold text-ink"
                          onClick={() => s.sessionId && run("Сессия сброшена", () => post(`/api/v1/sessions/${s.sessionId}/stop`))}
                        >
                          Сброс
                        </button>
                      )}
                      <label className="mt-2 flex items-center gap-2 text-xs text-dim">
                        <input
                          type="checkbox"
                          className="hud-check"
                          checked={occupied}
                          onChange={() => setSelected(s)}
                        />
                        Посадка
                      </label>
                      <p className="truncate text-sm font-semibold text-ink">{s.guestName ?? ""}</p>
                    </div>
                  );
                })}
            </div>
          </section>
        ))}
      </div>

      <aside className="panel-hud p-5">
        {!selected ? (
          <p className="text-mute">Выберите ПК на карте, чтобы управлять сессией.</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-2xl text-paper">{selected.label}</h3>
              <span className="text-sm text-mute">{STATUS_RU[selected.status]}</span>
            </div>
            {selected.sessionId ? (
              <div className="mt-4 space-y-3 text-sm">
                <p className="text-fog">
                  Гость: <span className="text-paper">{selected.guestName}</span>
                </p>
                <p className="text-fog">
                  Осталось: <span className="text-paper">{hms(selected.remainingSeconds)}</span> · баланс{" "}
                  <span className="text-paper">{selected.balanceKopecks != null ? formatByn(selected.balanceKopecks) : "—"}</span>
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {selected.sessionStatus === "PAUSED" ? (
                    <Btn onClick={() => run("Сессия продолжена", () => post(`/api/v1/sessions/${selected.sessionId}/resume`))}>Продолжить</Btn>
                  ) : (
                    <Btn onClick={() => run("Сессия на паузе", () => post(`/api/v1/sessions/${selected.sessionId}/pause`))}>Пауза</Btn>
                  )}
                  <Btn tone="danger" onClick={() => run("Сессия завершена", () => post(`/api/v1/sessions/${selected.sessionId}/stop`))}>
                    Завершить
                  </Btn>
                </div>
                <div className="flex gap-2 pt-2">
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                    className="min-h-11 w-24 rounded-[3px] bg-void px-3 text-fog"
                    aria-label="Минут"
                  />
                  <Btn onClick={() => run(`Продлено на ${minutes} мин`, () => post(`/api/v1/sessions/${selected.sessionId}/extend`, { minutes }))}>
                    Продлить
                  </Btn>
                </div>
                <div className="pt-2">
                  <label className="text-mute" htmlFor="transfer">
                    Перенести на ПК
                  </label>
                  <select
                    id="transfer"
                    className="mt-1 min-h-11 w-full rounded-[3px] bg-void px-3 text-fog"
                    defaultValue=""
                    onChange={(e) => {
                      const to = e.target.value;
                      if (to) run("Сессия перенесена", () => post(`/api/v1/sessions/${selected.sessionId}/transfer`, { toSeatId: to }));
                    }}
                  >
                    <option value="">Выберите свободный ПК</option>
                    {seats
                      .filter((s) => s.status === "FREE")
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.zoneName} · {s.label}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-sm">
                <label className="block text-mute" htmlFor="guest">
                  Гость (телефон, имя или карта)
                </label>
                <input
                  id="guest"
                  value={guestQuery}
                  onChange={(e) => setGuestQuery(e.target.value)}
                  className="min-h-11 w-full rounded-[3px] bg-void px-3 text-fog"
                  placeholder="+375…"
                />
                {guests.length > 0 && guestQuery.length >= 2 && (
                  <ul className="max-h-40 overflow-auto rounded-[3px] bg-void">
                    {guests.map((g) => (
                      <li key={g.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setGuestId(g.id);
                            setGuestQuery(`${g.displayName} · ${g.phone}`);
                            setGuests([]);
                          }}
                          className="flex w-full justify-between px-3 py-2 text-left hover:bg-velvet"
                        >
                          <span className="text-fog">
                            {g.displayName} · {g.phone}
                          </span>
                          <span className="text-coral">{formatByn(g.balanceKopecks)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <label className="block text-mute" htmlFor="tariff">
                  Тариф
                </label>
                <select id="tariff" value={tariffId} onChange={(e) => setTariffId(e.target.value)} className="min-h-11 w-full rounded-[3px] bg-void px-3 text-fog">
                  {club?.tariffs?.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {formatByn(t.pricePerHourKopecks)}/ч
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setMode("WALLET")} className={`min-h-11 rounded-[2px] ${mode === "WALLET" ? "bg-accent text-ink" : "bg-base text-dim"}`}>
                    По балансу
                  </button>
                  <button type="button" onClick={() => setMode("PREPAID")} className={`min-h-11 rounded-[2px] ${mode === "PREPAID" ? "bg-accent text-ink" : "bg-base text-dim"}`}>
                    Пакет минут
                  </button>
                </div>
                {mode === "PREPAID" && (
                  <input
                    type="number"
                    min={30}
                    step={30}
                    value={prepaid}
                    onChange={(e) => setPrepaid(Number(e.target.value))}
                    className="min-h-11 w-full rounded-[3px] bg-void px-3 text-fog"
                    aria-label="Минут в пакете"
                  />
                )}
                <Btn
                  tone="primary"
                  disabled={!guestId}
                  onClick={() =>
                    run("Сессия запущена", () =>
                      post(`/api/v1/clubs/${clubId}/sessions`, {
                        seatId: selected.id,
                        userId: guestId,
                        tariffId,
                        billingMode: mode,
                        ...(mode === "PREPAID" ? { prepaidMinutes: prepaid } : {}),
                      }),
                    )
                  }
                >
                  Запустить сессию
                </Btn>
              </div>
            )}

            <div className="mt-6 border-t border-white/10 pt-4">
              <p className="text-sm text-mute">Управление ПК</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                {[
                  ["LOCK", "Заблокировать"],
                  ["UNLOCK", "Разблокировать"],
                  ["REBOOT", "Перезагрузить"],
                  ["SHUTDOWN", "Выключить"],
                ].map(([c, l]) => (
                  <Btn key={c} onClick={() => run(`${l}: команда отправлена`, () => post(`/api/v1/clubs/${clubId}/seats/${selected.id}/command`, { command: c }))}>
                    {l}
                  </Btn>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                {selected.status === "MAINTENANCE" ? (
                  <Btn onClick={() => run("ПК снова в работе", () => api(`/api/v1/seats/${selected.id}`, { method: "PATCH", body: JSON.stringify({ status: "FREE" }) }))}>
                    Вернуть в зал
                  </Btn>
                ) : (
                  <Btn onClick={() => run("ПК в техническом режиме", () => api(`/api/v1/seats/${selected.id}`, { method: "PATCH", body: JSON.stringify({ status: "MAINTENANCE" }) }))}>
                    Технический режим
                  </Btn>
                )}
                <Btn
                  onClick={() => {
                    const body = prompt("Сообщение на экран гостя");
                    if (body) run("Сообщение отправлено", () => post(`/api/v1/clubs/${clubId}/chat`, { seatId: selected.id, body }));
                  }}
                >
                  Сообщение на ПК
                </Btn>
                <Btn
                  onClick={async () => {
                    const r = await api<{ code: string }>(`/api/v1/clubs/${clubId}/seats/${selected.id}/pair`, { method: "POST", body: "{}" });
                    setPairCode(r.code);
                    setMsg(`Код агента ${r.code} — 15 минут`);
                  }}
                >
                  Код агента
                </Btn>
              </div>
              {pairCode && <p className="mt-2 font-mono text-2xl tracking-[0.3em] text-ink">{pairCode}</p>}
              <p className="mt-3 text-xs text-mute">
                {selected.lastHeartbeatAt
                  ? `Агент на связи: ${new Date(selected.lastHeartbeatAt).toLocaleTimeString("ru-BY")}${selected.hostname ? `, ${selected.hostname}` : ""}${selected.currentProcess ? `, ${selected.currentProcess}` : ""}${selected.agentVersion ? ` · v${selected.agentVersion}` : ""}`
                  : selected.agentPaired
                    ? "Агент привязан, heartbeat нет"
                    : "Агент не привязан"}
              </p>
            </div>
          </>
        )}
        {msg && (
          <p className="mt-4 text-sm text-coral" role="status">
            {msg}
          </p>
        )}
      </aside>
    </div>
  );
}

export function Btn({
  children,
  onClick,
  tone = "default",
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "primary" | "danger";
  disabled?: boolean;
}) {
  const cls =
    tone === "primary"
      ? "btn-hud min-h-11 px-3"
      : tone === "danger"
        ? "bg-coral/20 text-coral"
        : "bg-base text-dim hover:text-ink";
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`min-h-11 rounded-[2px] px-3 font-medium disabled:opacity-40 ${cls}`}>
      {children}
    </button>
  );
}

export function translate(code: string) {
  const map: Record<string, string> = {
    SEAT_BUSY: "На этом ПК уже идёт сессия.",
    INSUFFICIENT_FUNDS: "У гостя не хватает средств на балансе.",
    WALLET_NOT_FOUND: "У гостя нет кошелька.",
    SEAT_UNAVAILABLE: "ПК недоступен: сервис или офлайн.",
    SESSION_INACTIVE: "Сессия уже завершена.",
    SLOT_TAKEN: "Слот уже занят.",
    FORBIDDEN: "Недостаточно прав.",
    UNAUTHORIZED: "Войдите заново.",
    GUEST_NAME_REQUIRED: "Укажите имя гостя.",
    CASH_NOT_FOUND: "Чек кассы не найден.",
    CASH_VOID: "Этот чек уже отменён.",
    CASH_ALREADY_POSTED: "Чек уже зачислен.",
    USER_NOT_FOUND: "Гость не найден.",
    PHONE_TAKEN: "Этот телефон уже в базе.",
  };
  return map[code] ?? code;
}
