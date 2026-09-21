"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatByn } from "@/lib/money";
import { csvDownload } from "./ops-ui";

export function NetworkDash() {
  const [grain, setGrain] = useState("day");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [d, setD] = useState<any>(null);
  function load() {
    const days = grain === "month" ? 30 : grain === "hour" ? 1 : 1;
    api(`/api/v1/analytics/network?days=${days}&grain=${grain}&date=${date}`).then(setD).catch(() => undefined);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const k = d?.kpis ?? {};
  const tiles = [
    [formatByn(k.sessionRevenueKopecks + k.barRevenueKopecks || 0), "Итоговая выручка"],
    [k.uniqueGuests ?? 0, "Всего гостей"],
    [k.registrations ?? 0, "Регистраций"],
    [k.sessions ?? 0, "Сессий"],
    [k.uniqueSessions ?? 0, "Уникальных сессий"],
    [formatByn(k.avgSessionCheckKopecks ?? 0), "Средний чек сеанса"],
    [formatByn(k.avgTopupKopecks ?? 0), "Средний чек пополнения"],
    [formatByn(k.avgBarCheckKopecks ?? 0), "Средний чек бара"],
    [k.occupied ?? 0, "Количество активных ПК за период"],
    [0, "Количество активных ТВ за период"],
    [formatByn(0), "Выручка с устройства в день"],
    [formatByn(0), "Выручка с ТВ в день"],
    [formatByn(k.barRevenueKopecks ?? 0), "Выручка бара"],
    [formatByn(k.cashPostedKopecks ?? 0), "Ручные пополнения"],
    [formatByn(k.bonusGrantedKopecks ?? 0), "Сумма пополнений бонусов"],
    [k.bonusGrantedCount ?? 0, "Количество пополнений бонусов"],
  ] as const;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className="ops-field max-w-[160px]" value={grain} onChange={(e) => setGrain(e.target.value)}>
          <option value="day">По дням</option>
          <option value="month">По месяцам</option>
          <option value="hour">По часам</option>
        </select>
        <input type="date" className="ops-field max-w-[160px]" value={date} onChange={(e) => setDate(e.target.value)} />
        <button type="button" className="ops-pill is-on" onClick={load}>
          Применить
        </button>
        <button
          type="button"
          className="ops-pill"
          onClick={() => {
            setGrain("day");
            setDate(new Date().toISOString().slice(0, 10));
            load();
          }}
        >
          Сброс
        </button>
      </div>
      <p className="mb-3 rounded bg-[#dbeafe] px-3 py-2 text-sm text-[#1e3a8a]">
        В данном дашборде используется централизованный сбор статистики по всем клубам на {date}
      </p>
      <p className="mb-2 font-semibold">Данные за период</p>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {tiles.map(([v, l]) => (
          <div key={l} className="kpi-blue">
            <p className="kpi-v">{v}</p>
            <p className="mt-2 text-sm text-white/80">{l}</p>
          </div>
        ))}
      </div>
      <button type="button" className="mt-4 rounded bg-coral px-3 py-2 text-sm text-white" onClick={() => csvDownload("network.csv", d?.clubs ?? [])}>
        Экспорт в CSV
      </button>
    </div>
  );
}
