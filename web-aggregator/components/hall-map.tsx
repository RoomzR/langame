"use client";

import { useState } from "react";

type Seat = {
  id: string;
  label: string;
  status: string;
  posX: number;
  posY: number;
  type?: string;
  zoneName?: string;
  hardwareProfile?: { name: string } | null;
};

const FILL = {
  selected: { bg: "#2015FF", color: "#FFFFFF", shadow: "0 0 0 2px #2015FF, 0 0 24px rgba(32,21,255,.45)" },
  service: { bg: "transparent", color: "#A0A0A0", shadow: "inset 0 0 0 2px #222222" },
  free: { bg: "rgba(32, 21, 255, 0.28)", color: "#FFFFFF", shadow: "inset 0 0 0 2px #2015FF" },
  busy: { bg: "rgba(255, 133, 98, 0.18)", color: "#ff8562", shadow: "inset 0 0 0 2px #ff8562" },
};

export function HallMap({
  seats,
  selectedId,
  onSelect,
  availability,
  legend = true,
}: {
  seats: Seat[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  availability?: Record<string, boolean>;
  legend?: boolean;
}) {
  const [pick, setPick] = useState<string | null>(null);
  const maxX = Math.max(160, ...seats.map((s) => s.posX + 80));
  const maxY = Math.max(120, ...seats.map((s) => s.posY + 60));

  function choose(id: string, free: boolean, service: boolean) {
    if (service || !free) return;
    setPick(id);
    window.setTimeout(() => onSelect?.(id), 320);
  }

  const tile = (s: Seat, mode: "snap" | "map") => {
    const free = availability ? availability[s.id] !== false : s.status === "FREE";
    const service = s.status === "MAINTENANCE" || s.status === "OFFLINE";
    const selected = s.id === selectedId;
    const look = selected ? FILL.selected : service ? FILL.service : free ? FILL.free : FILL.busy;
    return (
      <button
        key={s.id}
        type="button"
        disabled={service || !free}
        onClick={() => choose(s.id, free, service)}
        aria-pressed={selected}
        aria-label={`${s.label}, ${service ? "сервис" : free ? "свободно" : "занято"}${s.hardwareProfile ? `, ${s.hardwareProfile.name}` : ""}`}
        className={`${free && !selected ? "seat-free" : ""} ${pick === s.id ? "seat-pick" : ""} ${
          mode === "map"
            ? "absolute flex min-h-11 min-w-[11%] flex-col items-start justify-center rounded-[2px] px-2 py-1 text-left text-xs font-medium"
            : "flex h-14 flex-col items-start justify-center rounded-[2px] px-2 text-xs font-medium"
        }`}
        style={{
          ...(mode === "map"
            ? {
                left: `${(s.posX / maxX) * 100}%`,
                top: `${(s.posY / maxY) * 100}%`,
                width: `${(72 / maxX) * 100}%`,
              }
            : {}),
          background: look.bg,
          color: look.color,
          boxShadow: look.shadow,
          cursor: service || !free ? "default" : "pointer",
        }}
      >
        {s.label}
        <span className="text-[10px] font-normal opacity-80">{service ? "сервис" : free ? "свободно" : "занято"}</span>
      </button>
    );
  };

  return (
    <div>
      <div className="hall-snap md:hidden">{seats.map((s) => tile(s, "snap"))}</div>
      <div className="hall-grid relative hidden overflow-hidden border border-line bg-base md:block">
        <div className="relative" style={{ paddingBottom: `${Math.min(70, (maxY / maxX) * 100 + 8)}%` }}>
          {seats.map((s) => tile(s, "map"))}
        </div>
      </div>
      {legend && (
        <div className="mt-3 hidden flex-wrap gap-5 text-xs text-dim md:flex">
          <span className="flex items-center gap-2">
            <i className="inline-block h-2 w-4" style={{ boxShadow: "inset 0 0 0 2px #2015FF", background: "rgba(32,21,255,.28)" }} /> свободно
          </span>
          <span className="flex items-center gap-2">
            <i className="inline-block h-2 w-4" style={{ boxShadow: "inset 0 0 0 2px #ff8562", background: "rgba(255,133,98,.18)" }} /> занято
          </span>
          <span className="flex items-center gap-2">
            <i className="inline-block h-2 w-4 bg-accent" /> выбрано
          </span>
          <span className="flex items-center gap-2">
            <i className="inline-block h-2 w-4" style={{ boxShadow: "inset 0 0 0 2px #222" }} /> сервис
          </span>
        </div>
      )}
    </div>
  );
}
