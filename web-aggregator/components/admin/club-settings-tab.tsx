"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Btn, translate } from "./hall-tab";

export function ClubSettingsTab({ clubId, club, onSaved }: { clubId: string; club: any; onSaved?: () => void }) {
  const [name, setName] = useState(club?.name ?? "");
  const [city, setCity] = useState(club?.city ?? "");
  const [address, setAddress] = useState(club?.address ?? "");
  const [description, setDescription] = useState(club?.description ?? "");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setName(club?.name ?? "");
    setCity(club?.city ?? "");
    setAddress(club?.address ?? "");
    setDescription(club?.description ?? "");
  }, [club]);

  async function save() {
    setMsg("");
    try {
      await api(`/api/v1/clubs/${clubId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, city, address, description }),
      });
      setMsg("Клуб сохранён");
      onSaved?.();
    } catch (e: any) {
      setMsg(translate(e.message));
    }
  }

  return (
    <div className="max-w-lg">
      <h2 className="display text-[40px] text-ink">Клуб</h2>
      <label className="mt-6 block text-sm text-dim">Название</label>
      <input className="field-hud mt-1" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="mt-4 block text-sm text-dim">Город</label>
      <input className="field-hud mt-1" value={city} onChange={(e) => setCity(e.target.value)} />
      <label className="mt-4 block text-sm text-dim">Адрес</label>
      <input className="field-hud mt-1" value={address} onChange={(e) => setAddress(e.target.value)} />
      <label className="mt-4 block text-sm text-dim">Описание</label>
      <textarea className="field-hud mt-1 min-h-28 py-3" value={description} onChange={(e) => setDescription(e.target.value)} />
      <Btn tone="primary" onClick={save}>
        Сохранить
      </Btn>
      {msg && <p className="mt-3 text-sm text-coral">{msg}</p>}
    </div>
  );
}
