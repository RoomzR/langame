"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatByn } from "@/lib/money";
import { Btn, translate } from "./hall-tab";

function hm(sec: number) {
  return `${Math.floor(sec / 60)} мин`;
}

export function ShiftTab({ clubId }: { clubId: string }) {
  const [overview, setOverview] = useState<any>(null);
  const [occupancy, setOccupancy] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [retention, setRetention] = useState<any>(null);
  const [shifts, setShifts] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [log, setLog] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  const [cash, setCash] = useState({ open: "0", total: "", cash: "", card: "", sbp: "0", expenses: "0", collection: "0", writeoff: "0", close: "" });
  const [closing, setClosing] = useState(false);

  async function load() {
    const [ov, occ, rev, ret, sh, rep, c, lg] = await Promise.all([
      api(`/api/v1/clubs/${clubId}/analytics/overview`),
      api(`/api/v1/clubs/${clubId}/analytics/occupancy?hours=24`),
      api(`/api/v1/clubs/${clubId}/analytics/revenue?days=7`),
      api(`/api/v1/clubs/${clubId}/analytics/retention`),
      api(`/api/v1/clubs/${clubId}/shifts`),
      api(`/api/v1/clubs/${clubId}/analytics/shift-report`),
      api(`/api/v1/clubs/${clubId}/calls`),
      api(`/api/v1/clubs/${clubId}/analytics/admin-log`),
    ]);
    setOverview(ov);
    setOccupancy(occ);
    setRevenue(rev);
    setRetention(ret);
    setShifts(sh as any[]);
    setReport(rep);
    setCalls(c as any[]);
    setLog(lg as any[]);
  }
  useEffect(() => {
    load().catch((e) => setMsg(translate(e.message)));
    const t = setInterval(() => load().catch(() => undefined), 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

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

  const open = shifts.find((s) => s.status === "OPEN");
  const maxRev = Math.max(1, ...(revenue?.days ?? []).map((d: any) => d.totalKopecks));

  return (
    <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-[6px] bg-velvet p-5">
          <div>
            <p className="text-sm text-mute">Смена</p>
            {open ? (
              <p className="font-display text-xl text-paper">
                Открыта {new Date(open.startedAt).toLocaleTimeString("ru-BY", { hour: "2-digit", minute: "2-digit" })} · {open.user?.displayName}
              </p>
            ) : (
              <p className="font-display text-xl text-paper">Смена закрыта</p>
            )}
          </div>
          {open ? (
            <button type="button" className="btn-hud min-h-12" onClick={() => setClosing(true)}>
              Закрыть смену
            </button>
          ) : (
            <Btn tone="primary" onClick={() => act("Смена открыта", () => api(`/api/v1/clubs/${clubId}/shifts/open`, { method: "POST", body: "{}" }))}>
              Открыть смену
            </Btn>
          )}
        </section>

        {closing && open && (
          <section className="mt-6 space-y-2 rounded-xl bg-elevated p-4">
            {(
              [
                ["open", "На начало смены"],
                ["cash", "Нал"],
                ["card", "Безнал"],
                ["sbp", "Планшет СБП"],
                ["expenses", "Расходы за смену"],
                ["collection", "Инкассация"],
                ["writeoff", "Списания"],
                ["close", "На конец смены"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-3 rounded-lg bg-base px-4 py-3">
                <span className="text-sm text-ink">{label}</span>
                <span className="flex items-center gap-2">
                  <input
                    className="field-hud w-28 text-right"
                    value={cash[key]}
                    onChange={(e) => setCash((c) => ({ ...c, [key]: e.target.value }))}
                  />
                  <span className="mono text-xs text-dim">BYN</span>
                </span>
              </label>
            ))}
            <div className="flex items-center justify-between rounded-lg bg-base px-4 py-3">
              <span className="text-sm text-ink">Общая выручка</span>
              <span className="mono text-ink">
                {formatByn((report?.overview?.sessionRevenueKopecks ?? 0) + (report?.overview?.barRevenueKopecks ?? 0))}
              </span>
            </div>
            <button
              type="button"
              className="mt-3 min-h-12 w-full rounded-xl bg-white font-bold text-coral"
              onClick={() =>
                act("Смена закрыта", async () => {
                  await api(`/api/v1/clubs/${clubId}/shifts/${open.id}/close`, {
                    method: "POST",
                    body: JSON.stringify(cash),
                  });
                  setClosing(false);
                })
              }
            >
              Закрыть смену
            </button>
            <button type="button" className="btn-login w-full justify-center" onClick={() => setClosing(false)}>
              Отмена
            </button>
          </section>
        )}

        {overview && (
          <dl className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
            <Stat label="Загрузка сейчас" value={`${overview.occupancyPct}%`} sub={`${overview.occupied} из ${overview.seats} ПК`} />
            <Stat label="Сессий сегодня" value={overview.sessions} sub={`${overview.uniqueGuests} гостей`} />
            <Stat label="Выручка сессий" value={formatByn(overview.sessionRevenueKopecks)} sub="с начала дня" />
            <Stat label="Бар и мерч" value={formatByn(overview.barRevenueKopecks)} sub={`средняя сессия ${hm(overview.avgSessionSeconds)}`} />
          </dl>
        )}

        {occupancy?.buckets && (
          <section className="mt-10">
            <h3 className="font-display text-xl text-paper">Загрузка за 24 часа</h3>
            <div className="mt-4 flex h-36 items-end gap-1" role="img" aria-label="Загрузка зала по часам">
              {occupancy.buckets.map((b: any) => (
                <div key={b.hour} className="group relative flex-1">
                  <div className="w-full rounded-t-[2px] bg-accent/80 transition-[height]" style={{ height: `${Math.max(3, b.occupancyPct) * 1.3}px` }} />
                  <span className="absolute -top-6 left-1/2 hidden -translate-x-1/2 text-xs text-fog group-hover:block">
                    {new Date(b.hour).getHours()}:00 · {b.occupancyPct}%
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-mute">
              <span>{new Date(occupancy.buckets[0].hour).getHours()}:00</span>
              <span>сейчас</span>
            </div>
          </section>
        )}

        {revenue?.days && (
          <section className="mt-10">
            <h3 className="font-display text-xl text-paper">Выручка за 7 дней</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {revenue.days.map((d: any) => (
                <li key={d.date} className="grid grid-cols-[80px_1fr_100px] items-center gap-3">
                  <span className="text-mute">{new Date(d.date).toLocaleDateString("ru-BY", { day: "2-digit", month: "2-digit" })}</span>
                  <div className="flex h-5 overflow-hidden rounded-[2px] bg-void">
                    <div className="bg-accent" style={{ width: `${(d.sessionKopecks / maxRev) * 100}%` }} title="сессии" />
                    <div className="bg-coral" style={{ width: `${(d.barKopecks / maxRev) * 100}%` }} title="бар" />
                  </div>
                  <span className="text-right text-paper">{formatByn(d.totalKopecks)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-dim">синий — сессии, коралл — бар и мерч</p>
          </section>
        )}

        {retention && (
          <section className="mt-10 rounded-[6px] border border-white/10 p-5">
            <h3 className="font-display text-xl text-paper">Возвращаемость за 30 дней</h3>
            <p className="mt-2 text-fog">
              {retention.returning} из {retention.guests} гостей были два и более раз — {retention.retentionPct}%.
            </p>
          </section>
        )}
      </div>

      <aside className="space-y-8">
        {report?.shift && (
          <section className="panel-hud p-5">
            <h3 className="font-display text-xl text-ink">Отчёт смены</h3>
            <p className="text-sm text-dim">
              с {new Date(report.shift.startedAt).toLocaleString("ru-BY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-dim">Сессии</dt>
                <dd className="font-display text-xl text-ink">{report.overview.sessions}</dd>
              </div>
              <div>
                <dt className="text-dim">Гости</dt>
                <dd className="font-display text-xl text-ink">{report.overview.uniqueGuests}</dd>
              </div>
              <div>
                <dt className="text-dim">Выручка сессий</dt>
                <dd className="font-display text-xl text-coral">{formatByn(report.overview.sessionRevenueKopecks)}</dd>
              </div>
              <div>
                <dt className="text-dim">Бар</dt>
                <dd className="font-display text-xl text-coral">{formatByn(report.overview.barRevenueKopecks)}</dd>
              </div>
            </dl>
          </section>
        )}

        <section>
          <h3 className="font-display text-xl text-paper">Вызовы администратора</h3>
          <ul className="mt-3 divide-y divide-white/10 text-sm">
            {calls.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <span className="text-fog">
                  <span className="text-paper">{c.seat?.label}</span> · {c.user?.displayName} · {c.message || "помощь"}
                </span>
                <button type="button" className="link-coral" onClick={() => act("Вызов закрыт", () => api(`/api/v1/clubs/${clubId}/calls/${c.id}/resolve`, { method: "POST", body: "{}" }))}>
                  Закрыть
                </button>
              </li>
            ))}
            {calls.length === 0 && <li className="py-3 text-mute">Открытых вызовов нет.</li>}
          </ul>
        </section>

        <section>
          <h3 className="font-display text-xl text-paper">Прошлые смены</h3>
          <ul className="mt-3 divide-y divide-white/10 text-sm">
            {shifts.slice(0, 8).map((s) => (
              <li key={s.id} className="py-2 text-fog">
                {new Date(s.startedAt).toLocaleString("ru-BY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                {s.endedAt ? ` — ${new Date(s.endedAt).toLocaleTimeString("ru-BY", { hour: "2-digit", minute: "2-digit" })}` : " — открыта"} · {s.user?.displayName}
              </li>
            ))}
          </ul>
        </section>

        {log.length > 0 && (
          <section>
            <h3 className="font-display text-xl text-paper">Журнал действий</h3>
            <ul className="mt-3 divide-y divide-white/10 text-xs text-mute">
              {log.slice(0, 15).map((l) => (
                <li key={l.id} className="py-2">
                  {new Date(l.createdAt).toLocaleTimeString("ru-BY", { hour: "2-digit", minute: "2-digit" })} · {l.user?.displayName} · {l.action}
                </li>
              ))}
            </ul>
          </section>
        )}
        {msg && (
          <p className="text-sm text-coral" role="status">
            {msg}
          </p>
        )}
      </aside>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: any; sub?: string }) {
  return (
    <div>
      <dt className="text-sm text-mute">{label}</dt>
      <dd className="mt-1 font-display text-3xl text-paper">{value}</dd>
      {sub && <p className="text-xs text-mute">{sub}</p>}
    </div>
  );
}
