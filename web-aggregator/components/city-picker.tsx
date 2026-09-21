"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { MARKET } from "@/lib/money";

export function CityPicker({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const city = params.get("city") ?? "";
  const q = params.get("q") ?? "";

  function go(next: Record<string, string>) {
    const p = new URLSearchParams();
    const merged = { city, q, ...next };
    if (merged.city) p.set("city", merged.city);
    if (merged.q) p.set("q", merged.q);
    router.push(`/${p.toString() ? `?${p}` : ""}#clubs`);
  }

  return (
    <form
      className={`flex flex-wrap gap-2 ${compact ? "" : "glass rounded-xl p-2"}`}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        go({ q: String(fd.get("q") ?? "") });
      }}
    >
      <label className="sr-only" htmlFor={compact ? "city2" : "city"}>
        Город
      </label>
      <select
        id={compact ? "city2" : "city"}
        value={city}
        onChange={(e) => go({ city: e.target.value })}
        className="field-hud min-h-14 w-auto min-w-[160px] font-semibold"
      >
        <option value="">Все города</option>
        {MARKET.cities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={compact ? "q2" : "q"}>
        Поиск клуба
      </label>
      <input
        id={compact ? "q2" : "q"}
        name="q"
        defaultValue={q}
        placeholder="Клуб или улица"
        className="field-hud min-h-14 min-w-[200px] flex-1"
      />
      <button className="btn-hud min-h-14 w-full md:w-auto">Найти</button>
    </form>
  );
}
