"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Btn, translate } from "./hall-tab";

type Seat = { id: string; label: string; posX: number; posY: number; zoneId: string; status: string };
type Zone = { id: string; name: string; color: string; seats: Seat[] };

export function MapTab({ clubId, club, onSaved }: { clubId: string; club: any; onSaved?: () => void }) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [msg, setMsg] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [seatLabel, setSeatLabel] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);

  useEffect(() => {
    const z: Zone[] =
      club?.zones?.map((zn: any) => ({
        id: zn.id,
        name: zn.name,
        color: zn.color || "#2015FF",
        seats: zn.seats.map((s: any) => ({ id: s.id, label: s.label, posX: s.posX, posY: s.posY, zoneId: zn.id, status: s.status })),
      })) ?? [];
    setZones(z);
    setZoneId(z[0]?.id ?? "");
  }, [club]);

  const all = zones.flatMap((z) => z.seats);

  async function act(label: string, fn: () => Promise<unknown>) {
    setMsg("");
    try {
      await fn();
      setMsg(label);
      onSaved?.();
    } catch (e: any) {
      setMsg(translate(e.message));
    }
  }

  async function addZone() {
    if (!zoneName.trim()) return;
    await act("Зона создана", () => api(`/api/v1/clubs/${clubId}/zones`, { method: "POST", body: JSON.stringify({ name: zoneName, color: "#2015FF" }) }));
    setZoneName("");
  }

  async function addSeat() {
    if (!zoneId || !seatLabel.trim()) return;
    const maxY = Math.max(0, ...all.map((s) => s.posY));
    await act("Место добавлено", () =>
      api(`/api/v1/clubs/${clubId}/zones/${zoneId}/seats`, {
        method: "POST",
        body: JSON.stringify({ label: seatLabel, posX: (all.length % 8) * 90, posY: maxY + 90 }),
      }),
    );
    setSeatLabel("");
  }

  async function saveLayout() {
    await act("Карта сохранена", async () => {
      for (const s of all) {
        await api(`/api/v1/seats/${s.id}`, { method: "PATCH", body: JSON.stringify({ posX: Math.round(s.posX), posY: Math.round(s.posY) }) });
      }
    });
  }

  function move(id: string, x: number, y: number) {
    setZones((zs) => zs.map((z) => ({ ...z, seats: z.seats.map((s) => (s.id === id ? { ...s, posX: x, posY: y } : s)) })));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-dim">Перетащите плитки. Сохраните, чтобы гости увидели новую карту.</p>
          <Btn tone="primary" onClick={saveLayout}>
            Сохранить
          </Btn>
        </div>
        <div
          className="relative h-[520px] overflow-hidden rounded-xl border border-line bg-elevated"
          onPointerMove={(e) => {
            if (!drag) return;
            const box = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            move(drag.id, e.clientX - box.left - drag.dx, e.clientY - box.top - drag.dy);
          }}
          onPointerUp={() => setDrag(null)}
          onPointerLeave={() => setDrag(null)}
        >
          {zones.map((z) =>
            z.seats.map((s) => (
              <button
                key={s.id}
                type="button"
                onPointerDown={(e) => {
                  const box = (e.currentTarget.parentElement as HTMLDivElement).getBoundingClientRect();
                  setDrag({ id: s.id, dx: e.clientX - box.left - s.posX, dy: e.clientY - box.top - s.posY });
                }}
                className="absolute flex h-14 w-[88px] cursor-grab items-center justify-center rounded-md text-xs font-bold text-ink active:cursor-grabbing"
                style={{ left: s.posX, top: s.posY, background: z.color }}
              >
                {s.label}
              </button>
            )),
          )}
        </div>
      </div>
      <aside className="panel-hud p-5">
        <h3 className="display text-[32px] text-ink">Карта</h3>
        <label className="mt-5 block text-sm text-dim">Новая зона</label>
        <div className="mt-1 flex gap-2">
          <input className="field-hud" value={zoneName} onChange={(e) => setZoneName(e.target.value)} placeholder="VIP" />
          <Btn onClick={addZone}>+</Btn>
        </div>
        <label className="mt-5 block text-sm text-dim">Новое место</label>
        <select className="field-hud mt-1" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
        <div className="mt-2 flex gap-2">
          <input className="field-hud" value={seatLabel} onChange={(e) => setSeatLabel(e.target.value)} placeholder="PC-09" />
          <Btn tone="primary" onClick={addSeat}>
            +
          </Btn>
        </div>
        <ul className="mt-6 space-y-2 text-sm text-dim">
          {zones.map((z) => (
            <li key={z.id}>
              <span className="text-ink">{z.name}</span> · {z.seats.length} мест
            </li>
          ))}
        </ul>
        {msg && <p className="mt-4 text-sm text-coral">{msg}</p>}
      </aside>
    </div>
  );
}
