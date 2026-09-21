"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatByn } from "@/lib/money";

type SeriesDay = { date: string; visits: number; uniqueGuests: number; newGuests: number };
type ClubRow = {
  id: string;
  name: string;
  city: string;
  uniqueGuests: number;
  visits?: number;
  newGuests?: number;
  sessions: number;
  occupancyPct: number;
  sessionRevenueKopecks: number;
  barRevenueKopecks: number;
  revenueKopecks?: number;
};

function LineChart({ days }: { days: SeriesDay[] }) {
  const w = 720;
  const h = 220;
  const pad = { l: 28, r: 12, t: 16, b: 28 };
  const max = Math.max(1, ...days.flatMap((d) => [d.visits, d.uniqueGuests]));
  const x = (i: number) => pad.l + (i / Math.max(1, days.length - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
  const path = (key: "visits" | "uniqueGuests") =>
    days.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(" ");
  const last = days[days.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-56 w-full" role="img" aria-label="График гостей и посещений">
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line key={g} x1={pad.l} x2={w - pad.r} y1={y(max * g)} y2={y(max * g)} stroke="rgba(255,255,255,.08)" />
      ))}
      <path d={path("visits")} fill="none" stroke="#ff6a3d" strokeWidth="2.4" />
      <path d={path("uniqueGuests")} fill="none" stroke="#7aa2ff" strokeWidth="2.4" />
      {last && (
        <>
          <circle cx={x(days.length - 1)} cy={y(last.visits)} r="4" fill="#ff6a3d" />
          <text x={x(days.length - 1) - 8} y={y(last.visits) - 10} fill="#fff" fontSize="12" textAnchor="end">
            {last.visits}
          </text>
        </>
      )}
      {days.filter((_, i) => i % Math.ceil(days.length / 8) === 0).map((d) => (
        <text key={d.date} x={x(days.indexOf(d))} y={h - 8} fill="rgba(255,255,255,.4)" fontSize="10" textAnchor="middle">
          {d.date.slice(8, 10)}.{d.date.slice(5, 7)}
        </text>
      ))}
    </svg>
  );
}

function Donut({ total, unique, neu }: { total: number; unique: number; neu: number }) {
  const sum = Math.max(1, total);
  const segs = [
    { v: total, c: "#2015ff" },
    { v: unique, c: "#ff6a3d" },
    { v: neu, c: "#7aa2ff" },
  ];
  let acc = 0;
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 140 140" className="h-40 w-40" role="img" aria-label="Состав посещений">
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="18" />
        {segs.map((s) => {
          const len = (s.v / sum) * c;
          const dash = `${len} ${c - len}`;
          const el = (
            <circle
              key={s.c}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={s.c}
              strokeWidth="18"
              strokeDasharray={dash}
              strokeDashoffset={-acc}
              transform="rotate(-90 70 70)"
            />
          );
          acc += len;
          return el;
        })}
        <text x="70" y="66" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="800">
          {total.toLocaleString("ru-BY")}
        </text>
        <text x="70" y="84" textAnchor="middle" fill="rgba(255,255,255,.5)" fontSize="10">
          посещений
        </text>
      </svg>
      <ul className="space-y-2 text-sm">
        <li className="flex items-center gap-2 text-fog">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" /> Всего · {total.toLocaleString("ru-BY")}
        </li>
        <li className="flex items-center gap-2 text-fog">
          <span className="h-2.5 w-2.5 rounded-full bg-coral" /> Уникальных · {unique.toLocaleString("ru-BY")}
        </li>
        <li className="flex items-center gap-2 text-fog">
          <span className="h-2.5 w-2.5 rounded-full bg-[#7aa2ff]" /> Новых · {neu.toLocaleString("ru-BY")}
        </li>
      </ul>
    </div>
  );
}

export function DashTab({ clubId, isSuper }: { clubId: string; isSuper: boolean }) {
  const [days, setDays] = useState(30);
  const [scope, setScope] = useState<"club" | "network">(isSuper ? "network" : "club");
  const [q, setQ] = useState("");
  const [overview, setOverview] = useState<any>(null);
  const [visits, setVisits] = useState<{ days: SeriesDay[]; totals: any } | null>(null);
  const [revenue, setRevenue] = useState<{ days: { date: string; totalKopecks: number; sessionKopecks: number; barKopecks: number }[] } | null>(null);
  const [network, setNetwork] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    setErr("");
    async function load() {
      try {
        if (scope === "network" && isSuper) {
          const n = await api<any>(`/api/v1/analytics/network?days=${days}`);
          if (alive) setNetwork(n);
          return;
        }
        const [o, v, r] = await Promise.all([
          api(`/api/v1/clubs/${clubId}/analytics/overview`),
          api<{ days: SeriesDay[]; totals: any }>(`/api/v1/clubs/${clubId}/analytics/visits?days=${days}`),
          api(`/api/v1/clubs/${clubId}/analytics/revenue?days=${days}`),
        ]);
        if (!alive) return;
        setOverview(o);
        setVisits(v);
        setRevenue(r as any);
      } catch (e: any) {
        if (alive) setErr(e.message === "FORBIDDEN" ? "Недостаточно прав" : "Не удалось загрузить дашборд");
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [clubId, days, scope, isSuper]);

  const series: SeriesDay[] = scope === "network" ? network?.series ?? [] : visits?.days ?? [];
  const totals = useMemo(() => {
    if (scope === "network" && network?.kpis) {
      return {
        guests: network.kpis.uniqueGuests,
        neu: network.kpis.newGuests,
        visits: network.kpis.visits,
        unique: network.kpis.uniquePeriod,
        revenue: network.kpis.sessionRevenueKopecks + network.kpis.barRevenueKopecks,
      };
    }
    return {
      guests: overview?.uniqueGuests ?? 0,
      neu: visits?.totals?.newGuests ?? 0,
      visits: visits?.totals?.visits ?? overview?.sessions ?? 0,
      unique: visits?.totals?.uniquePeriod ?? overview?.uniqueGuests ?? 0,
      revenue: (overview?.sessionRevenueKopecks ?? 0) + (overview?.barRevenueKopecks ?? 0),
    };
  }, [scope, network, overview, visits]);

  const clubs: ClubRow[] = (network?.clubs ?? []).filter((c: ClubRow) => {
    const n = q.trim().toLowerCase();
    if (!n) return true;
    return `${c.name} ${c.city}`.toLowerCase().includes(n);
  });

  const maxRev = Math.max(1, ...(revenue?.days.map((d) => d.totalKopecks) ?? [1]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="display text-4xl text-ink">Дашборд</h2>
          <p className="mt-1 text-sm text-dim">{scope === "network" ? "Вся сеть RUDEMIR" : "Показатели выбранного клуба"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isSuper && (
            <div className="flex rounded-lg bg-white/5 p-1 text-sm">
              <button type="button" className={`rounded-md px-3 py-1.5 ${scope === "network" ? "bg-accent text-ink" : "text-dim"}`} onClick={() => setScope("network")}>
                Сеть
              </button>
              <button type="button" className={`rounded-md px-3 py-1.5 ${scope === "club" ? "bg-accent text-ink" : "text-dim"}`} onClick={() => setScope("club")}>
                Клуб
              </button>
            </div>
          )}
          {[7, 14, 30].map((d) => (
            <button key={d} type="button" className={`rounded-md px-3 py-1.5 text-sm ${days === d ? "bg-white text-night" : "bg-white/5 text-dim"}`} onClick={() => setDays(d)}>
              {d} дн.
            </button>
          ))}
        </div>
      </div>

      {err && <p className="text-sm text-coral">{err}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Всего гостей", totals.guests],
          ["Новых гостей", totals.neu],
          ["Посещений", totals.visits],
          ["Уникальных", totals.unique],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl bg-white/[0.04] p-5">
            <p className="text-sm text-dim">{label}</p>
            <p className="display mt-2 text-4xl text-ink">{Number(value).toLocaleString("ru-BY")}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-2xl bg-white/[0.04] p-5">
          <p className="text-sm font-semibold text-ink">Гости и посещения</p>
          <p className="mt-1 text-xs text-dim">
            <span className="text-coral">●</span> посещения · <span className="text-[#7aa2ff]">●</span> уникальные гости
          </p>
          {series.length > 0 ? <LineChart days={series} /> : <p className="mt-8 text-sm text-dim">Пока нет данных за период.</p>}
        </div>
        <div className="rounded-2xl bg-white/[0.04] p-5">
          <p className="text-sm font-semibold text-ink">Состав за период</p>
          <div className="mt-4">
            <Donut total={totals.visits} unique={totals.unique} neu={totals.neu} />
          </div>
        </div>
      </div>

      {scope === "club" && revenue && (
        <div className="rounded-2xl bg-white/[0.04] p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold text-ink">Выручка</p>
            <p className="display text-2xl text-ink">{formatByn(totals.revenue)}</p>
          </div>
          <div className="mt-4 flex h-28 items-end gap-1">
            {revenue.days.map((d) => (
              <div key={d.date} className="flex-1 rounded-sm bg-accent/80" style={{ height: `${Math.max(4, (d.totalKopecks / maxRev) * 100)}%` }} title={`${d.date} · ${formatByn(d.totalKopecks)}`} />
            ))}
          </div>
        </div>
      )}

      {scope === "network" && isSuper && (
        <div className="rounded-2xl bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">Клубы сети</p>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск клуба или города" className="min-h-11 w-64 rounded-[4px] bg-void px-3 text-sm text-fog" />
          </div>
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-mute">
              <tr>
                <th className="py-2 font-normal">Клуб</th>
                <th className="py-2 font-normal">Гости</th>
                <th className="py-2 font-normal">Посещения</th>
                <th className="py-2 font-normal">Загрузка</th>
                <th className="py-2 font-normal">Выручка</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {clubs.map((c) => (
                <tr key={c.id}>
                  <td className="py-3">
                    <div className="text-paper">{c.name}</div>
                    <div className="text-xs text-mute">{c.city}</div>
                  </td>
                  <td className="py-3 text-fog">{c.uniqueGuests}</td>
                  <td className="py-3 text-fog">{c.visits ?? c.sessions}</td>
                  <td className="py-3 text-fog">{c.occupancyPct}%</td>
                  <td className="py-3 text-coral">{formatByn(c.revenueKopecks ?? c.sessionRevenueKopecks + c.barRevenueKopecks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
