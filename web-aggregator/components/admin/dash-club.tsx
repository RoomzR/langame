"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatByn } from "@/lib/money";

export function ClubDash({ clubId }: { clubId: string }) {
  const [tab, setTab] = useState<"sum" | "money" | "bal" | "hall">("sum");
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    api(`/api/v1/clubs/${clubId}/analytics/overview`).then(setD).catch(() => undefined);
  }, [clubId]);
  if (!d) return <p className="text-sm text-[#6b6f7a]">Сводка загружается…</p>;
  const seats = d.seats || 1;
  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          ["sum", "Сводка"],
          ["money", "Деньги"],
          ["bal", "Балансы"],
          ["hall", "Статус зала"],
        ].map(([id, label]) => (
          <button key={id} type="button" className={`ops-pill ${tab === id ? "is-on" : ""}`} onClick={() => setTab(id as any)}>
            {label}
          </button>
        ))}
      </div>
      <h3 className="mb-3 text-lg font-semibold">Сводная информация</h3>
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="ops-card">
          <p className="text-sm text-[#6b6f7a]">Деньги</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{formatByn(d.sessionRevenueKopecks + d.barRevenueKopecks)}</p>
          <p className="text-xs text-[#6b6f7a]">Выручка за сутки</p>
          <p className="mt-2 text-xl font-bold text-rose-500">{formatByn(d.expenseKopecks)}</p>
          <p className="text-xs text-[#6b6f7a]">Расходы за сутки</p>
        </div>
        <div className="grid gap-3">
          <div className="ops-card">
            <p className="text-sm text-[#6b6f7a]">Баланс аккаунтов</p>
            <p className="text-2xl font-bold">{formatByn(d.walletSumKopecks)}</p>
          </div>
          <div className="ops-card">
            <p className="text-sm text-[#6b6f7a]">Еда и услуги</p>
            <p className="text-2xl font-bold">{formatByn(d.barRevenueKopecks)}</p>
          </div>
        </div>
        <div className="ops-card">
          <p className="text-sm text-[#6b6f7a]">Балансы</p>
          <p className="mt-2 text-lg">
            Сводные ДС <span className="font-bold">{formatByn(d.walletSumKopecks)}</span>
          </p>
          <p className="text-lg text-fuchsia-700">
            Сводные бонусы <span className="font-bold">{formatByn(d.bonusSumKopecks)}</span>
          </p>
        </div>
      </div>
      {(tab === "sum" || tab === "hall") && (
        <div className="ops-card mt-4">
          <p className="font-semibold">Статус зала</p>
          <div className="mt-3 flex flex-wrap gap-6 text-sm">
            <span className="text-rose-600">Занято {d.occupied}</span>
            <span className="text-emerald-600">Свободно {d.free}</span>
            <span className="text-amber-600">Тех режим {d.maintenance}</span>
            <span className="text-sky-600">Разблок {d.reserved}</span>
            <span>Соединение {d.connected}</span>
          </div>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-zinc-200">
            <i className="bg-rose-500" style={{ width: `${(d.occupied / seats) * 100}%` }} />
            <i className="bg-emerald-500" style={{ width: `${(d.free / seats) * 100}%` }} />
            <i className="bg-amber-500" style={{ width: `${(d.maintenance / seats) * 100}%` }} />
            <i className="bg-sky-500" style={{ width: `${(d.reserved / seats) * 100}%` }} />
          </div>
          <div className="mt-4 flex gap-8 text-center text-xs">
            <div>
              <p className="text-2xl font-bold">{d.occupancyPct}%</p>
              <p>Текущая загрузка {d.occupied}/{d.seats}</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{Math.min(100, d.loadDayPct)}%</p>
              <p>Средняя загрузка сутки</p>
            </div>
          </div>
        </div>
      )}
      <div className="ops-card mt-4 max-w-md">
        <p className="text-sm text-[#6b6f7a]">Администратор в смене</p>
        {d.openShift ? (
          <p className="mt-2 font-semibold">
            {d.openShift.displayName}
            <span className="ml-2 text-sm font-normal text-[#6b6f7a]">
              {d.openShift.login} · с {new Date(d.openShift.startedAt).toLocaleTimeString("ru-BY", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-sm">Смена не открыта</p>
        )}
      </div>
    </div>
  );
}
