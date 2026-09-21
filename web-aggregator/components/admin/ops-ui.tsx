"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatByn } from "@/lib/money";
import { phoneLabel } from "@/lib/guest";

export function OpsTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="ops-h mb-4">{children}</h2>;
}

export function EmptyModule({ title, text }: { title: string; text?: string }) {
  return (
    <div className="ops-card max-w-xl">
      <h2 className="ops-h">{title}</h2>
      <p className="mt-2 text-sm text-[#6b6f7a]">
        {text ?? "Обратитесь к технической поддержке для активации данного функционала"}
      </p>
    </div>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-end gap-2">{children}</div>;
}

export function csvDownload(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const body = [keys.join(";"), ...rows.map((r) => keys.map((k) => String(r[k] ?? "")).join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

export function OpsTable({
  columns,
  rows,
  search,
}: {
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  search?: string;
}) {
  const filtered = useMemo(() => {
    const q = (search ?? "").trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => Object.values(r).join(" ").toLowerCase().includes(q));
  }, [rows, search]);
  return (
    <div className="ops-card overflow-x-auto">
      <table className="ops-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((r, i) => (
            <tr key={String(r.id ?? i)}>
              {columns.map((c) => (
                <td key={c.key}>{String(r[c.key] ?? "—")}</td>
              ))}
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="py-6 text-[#6b6f7a]">
                Записей нет
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function SettingsBlock({
  clubId,
  title,
  hint,
  fields,
}: {
  clubId: string;
  title: string;
  hint?: string;
  fields: { key: string; label: string; type?: string }[];
}) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  useEffect(() => {
    api<{ settings: Record<string, string> }>(`/api/v1/clubs/${clubId}/settings`)
      .then((r) => {
        const s = r.settings ?? {};
        const next: Record<string, string> = {};
        for (const f of fields) next[f.key] = String(s[f.key] ?? "");
        setVals(next);
      })
      .catch(() => undefined);
  }, [clubId, fields]);
  return (
    <div className="ops-card max-w-xl">
      <h2 className="ops-h">{title}</h2>
      {hint && <p className="mt-2 text-sm text-[#6b6f7a]">{hint}</p>}
      <div className="mt-4 grid gap-3">
        {fields.map((f) => (
          <label key={f.key} className="text-sm">
            {f.label}
            {f.type === "check" ? (
              <input
                type="checkbox"
                className="ml-3"
                checked={vals[f.key] === "1"}
                onChange={(e) => setVals({ ...vals, [f.key]: e.target.checked ? "1" : "0" })}
              />
            ) : (
              <input
                className="ops-field mt-1"
                value={vals[f.key] ?? ""}
                onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
              />
            )}
          </label>
        ))}
      </div>
      <button
        type="button"
        className="btn-hud mt-4 min-h-10 px-4 text-sm"
        onClick={async () => {
          setMsg("");
          try {
            await api(`/api/v1/clubs/${clubId}/settings`, { method: "PATCH", body: JSON.stringify(vals) });
            setMsg("Сохранено");
          } catch (e: any) {
            setMsg(e.message);
          }
        }}
      >
        Сохранить
      </button>
      {msg && <p className="mt-2 text-sm text-coral">{msg}</p>}
    </div>
  );
}

export function EventLog({ clubId, kind, title }: { clubId: string; kind: string; title: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    api<any[]>(`/api/v1/clubs/${clubId}/guest-events?kind=${encodeURIComponent(kind)}`)
      .then(setRows)
      .catch(() => setRows([]));
  }, [clubId, kind]);
  return (
    <div>
      <OpsTitle>{title}</OpsTitle>
      <FilterBar>
        <input className="ops-field max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" />
        <button type="button" className="ops-pill" onClick={() => csvDownload(`${kind}.csv`, rows)}>
          Экспорт CSV
        </button>
      </FilterBar>
      <OpsTable
        search={q}
        columns={[
          { key: "createdAt", label: "Когда" },
          { key: "who", label: "Гость" },
          { key: "payload", label: "Детали" },
        ]}
        rows={rows.map((r) => ({
          id: r.id,
          createdAt: new Date(r.createdAt).toLocaleString("ru-BY"),
          who: r.user ? `${r.user.displayName} ${phoneLabel(r.user.phone)}` : "—",
          payload: JSON.stringify(r.payload ?? {}),
        }))}
      />
    </div>
  );
}

export { formatByn };
