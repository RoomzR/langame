"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatByn } from "@/lib/money";
import { Btn, translate } from "./hall-tab";

export function GuestsTab({ clubId }: { clubId: string }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [sel, setSel] = useState<any | null>(null);
  const [amount, setAmount] = useState("10");
  const [bonus, setBonus] = useState("2");
  const [card, setCard] = useState({ number: "", pin: "" });
  const [reg, setReg] = useState({ phone: "+375", displayName: "" });
  const [msg, setMsg] = useState("");

  async function load() {
    setRows(await api(`/api/v1/clubs/${clubId}/guests${q ? `?q=${encodeURIComponent(q)}` : ""}`));
  }
  useEffect(() => {
    const t = setTimeout(() => load().catch((e) => setMsg(translate(e.message))), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, clubId]);

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
  const kop = (v: string) => Math.round(Number(v.replace(",", ".")) * 100);
  const field = "mt-1 min-h-11 w-full rounded-[3px] bg-void px-3 text-fog";

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <div>
        <label className="sr-only" htmlFor="gq">
          Поиск гостя
        </label>
        <input id="gq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Телефон, имя или номер карты" className="min-h-12 w-full rounded-[4px] bg-velvet px-4 text-fog" />
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-mute">
            <tr>
              <th className="py-2 font-normal">Гость</th>
              <th className="py-2 font-normal">Баланс</th>
              <th className="py-2 font-normal">Бонусы</th>
              <th className="py-2 font-normal">Сессий</th>
              <th className="py-2 font-normal">Карта</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((g) => (
              <tr key={g.id} className={`cursor-pointer hover:bg-velvet/60 ${sel?.id === g.id ? "bg-velvet" : ""}`} onClick={() => setSel(g)}>
                <td className="py-3">
                  <div className="text-paper">{g.displayName}</div>
                  <div className="text-xs text-mute">{g.phone}</div>
                </td>
                <td className="py-3 text-coral">{formatByn(g.balanceKopecks)}</td>
                <td className="py-3 text-fog">{formatByn(g.bonusKopecks)}</td>
                <td className="py-3 text-fog">{g.sessions}</td>
                <td className="py-3 text-fog">{g.cards.join(", ") || "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-mute">
                  Гостей не найдено. Зарегистрируйте нового справа.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <aside className="space-y-6">
        {sel && (
          <div className="rounded-[6px] bg-velvet p-5">
            <h3 className="font-display text-xl text-paper">{sel.displayName}</h3>
            <p className="text-sm text-mute">{sel.phone || "без телефона"} · с {new Date(sel.createdAt).toLocaleDateString("ru-BY")}</p>
            <p className="mt-2 text-xs text-mute">Касса принимает деньги на аппарате. Здесь — только зачисление на баланс.</p>
            <div className="mt-4 flex gap-2">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} className="min-h-11 w-24 rounded-[3px] bg-void px-3 text-fog" aria-label="Сумма, Br" />
              <Btn tone="primary" onClick={() => act(`Зачислено ${amount} Br после кассы`, () => api(`/api/v1/clubs/${clubId}/wallets/${sel.id}/topup`, { method: "POST", body: JSON.stringify({ amountKopecks: kop(amount), description: "принято в кассе, зачисление с сайта" }) }))}>
                Зачислить после кассы
              </Btn>
            </div>
            <div className="mt-2 flex gap-2">
              <input value={bonus} onChange={(e) => setBonus(e.target.value)} className="min-h-11 w-24 rounded-[3px] bg-void px-3 text-fog" aria-label="Бонус, Br" />
              <Btn onClick={() => act(`Бонус ${bonus} Br начислен`, () => api(`/api/v1/clubs/${clubId}/wallets/${sel.id}/bonus`, { method: "POST", body: JSON.stringify({ amountKopecks: kop(bonus) }) }))}>
                Начислить бонус
              </Btn>
            </div>
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="text-sm text-mute">Выдать карту гостя</p>
              <div className="mt-2 grid grid-cols-[1fr_80px_auto] gap-2">
                <input value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} placeholder="Номер" className="min-h-11 rounded-[3px] bg-void px-3 text-fog" aria-label="Номер карты" />
                <input value={card.pin} onChange={(e) => setCard({ ...card, pin: e.target.value })} placeholder="PIN" className="min-h-11 rounded-[3px] bg-void px-3 text-fog" aria-label="PIN" />
                <Btn onClick={() => act("Карта выдана", () => api(`/api/v1/clubs/${clubId}/guest-cards`, { method: "POST", body: JSON.stringify({ userId: sel.id, cardNumber: card.number, pin: card.pin }) }))}>
                  Выдать
                </Btn>
              </div>
            </div>
          </div>
        )}
        <div className="rounded-[6px] bg-velvet p-5">
          <h3 className="font-display text-xl text-paper">Новый гость</h3>
          <label className="mt-3 block text-sm text-mute" htmlFor="rn">
            Имя
          </label>
          <input id="rn" value={reg.displayName} onChange={(e) => setReg({ ...reg, displayName: e.target.value })} className={field} />
          <label className="mt-3 block text-sm text-mute" htmlFor="rp">
            Телефон (необязательно)
          </label>
          <input id="rp" value={reg.phone} onChange={(e) => setReg({ ...reg, phone: e.target.value })} className={field} />
          <div className="mt-4">
            <Btn
              tone="primary"
              disabled={!reg.displayName}
              onClick={() =>
                act("Гость записан", async () => {
                  const created = await api<any>(`/api/v1/clubs/${clubId}/walk-in`, {
                    method: "POST",
                    body: JSON.stringify({ displayName: reg.displayName, phone: reg.phone && reg.phone !== "+375" ? reg.phone : undefined }),
                  });
                  setQ(created.displayName);
                })
              }
            >
              Записать гостя
            </Btn>
          </div>
        </div>
        {msg && (
          <p className="text-sm text-coral" role="status">
            {msg}
          </p>
        )}
      </aside>
    </div>
  );
}
