"use client";

import { useState } from "react";

export type HallSeat = {
  id: string;
  label: string;
  status: string;
  posX: number;
  posY: number;
  zoneName?: string;
  hardwareProfile?: { name: string } | null;
};

type Props = {
  seats: HallSeat[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  availability?: Record<string, boolean>;
  className?: string;
  animate?: boolean;
  interactive?: boolean;
  bare?: boolean;
};

function seatState(s: HallSeat, selectedId?: string, availability?: Record<string, boolean>) {
  const service = s.status === "MAINTENANCE" || s.status === "OFFLINE";
  const free = !service && (availability ? availability[s.id] !== false : s.status === "FREE");
  const selected = s.id === selectedId;
  return { service, free, selected, cls: selected ? "is-selected" : service ? "is-service" : free ? "is-free" : "is-busy" };
}

function label(free: boolean, service: boolean) {
  return service ? "сервис" : free ? "свободно" : "занято";
}

function usePick(onSelect?: (id: string) => void) {
  const [pick, setPick] = useState<string | null>(null);
  function choose(id: string, free: boolean) {
    if (!free) return;
    setPick(id);
    window.setTimeout(() => {
      setPick(null);
      onSelect?.(id);
    }, 320);
  }
  return { pick, choose };
}

export function IsoHall({ seats, selectedId, onSelect, availability, className = "", animate = false, interactive, bare }: Props) {
  const live = interactive ?? Boolean(onSelect);
  const { pick, choose } = usePick(live ? onSelect : undefined);
  const maxX = Math.max(...seats.map((s) => s.posX), 160) + 84;
  const maxY = Math.max(...seats.map((s) => s.posY), 80) + 76;

  return (
    <div className={`iso-stage overflow-visible ${bare ? "py-2" : "py-6 md:py-10"} ${className}`}>
      <div
        className={`iso-plane ${bare ? "ml-auto w-full max-w-none" : "mx-auto w-[92%] max-w-[720px]"} ${animate ? "iso-rise" : ""}`}
        style={{ paddingBottom: `${Math.max(bare ? 44 : 48, (maxY / maxX) * (bare ? 70 : 88))}%` }}
      >
        {!bare && <div className="iso-floor" aria-hidden />}
        {seats.map((s) => {
          const st = seatState(s, selectedId, availability);
          const style = {
            left: `${(s.posX / maxX) * 100}%`,
            top: `${(s.posY / maxY) * 100}%`,
            width: `${((bare ? 70 : 66) / maxX) * 100}%`,
            height: `${((bare ? 56 : 54) / maxY) * 100}%`,
          };
          const cls = `iso-seat ${st.cls} ${pick === s.id ? "seat-pick" : ""} ${live ? "" : "pointer-events-none"}`;
          const text = bare ? "" : s.label;
          if (!live) {
            return (
              <div key={s.id} className={cls} style={style} aria-hidden>
                {text}
              </div>
            );
          }
          return (
            <button
              key={s.id}
              type="button"
              disabled={!st.free && !st.selected}
              onClick={() => choose(s.id, st.free)}
              aria-pressed={st.selected}
              aria-label={`${s.label}, ${label(st.free, st.service)}${s.hardwareProfile ? `, ${s.hardwareProfile.name}` : ""}`}
              className={cls}
              style={style}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FlatHall({ seats, selectedId, onSelect, availability, className = "", interactive }: Props) {
  const live = interactive ?? Boolean(onSelect);
  const { pick, choose } = usePick(live ? onSelect : undefined);
  return (
    <div className={`hall-snap ${className}`}>
      {seats.map((s) => {
        const st = seatState(s, selectedId, availability);
        const cls = `flat-seat ${st.cls} ${pick === s.id ? "scale-95" : ""} ${live ? "" : "pointer-events-none"}`;
        const inner = (
          <>
            <span className="font-bold">{s.label}</span>
            <span className="text-[10px] opacity-80">{label(st.free, st.service)}</span>
          </>
        );
        if (!live) {
          return (
            <div key={s.id} className={cls} aria-hidden>
              {inner}
            </div>
          );
        }
        return (
          <button
            key={s.id}
            type="button"
            disabled={!st.free && !st.selected}
            onClick={() => choose(s.id, st.free)}
            aria-pressed={st.selected}
            aria-label={`${s.label}, ${label(st.free, st.service)}`}
            className={cls}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
