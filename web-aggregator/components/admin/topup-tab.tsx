"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatByn } from "@/lib/money";
import { phoneLabel } from "@/lib/guest";
import { Btn, translate } from "./hall-tab";

const METHOD: Record<string, string> = { CASH: "наличные", CARD: "карта", ERIP: "ЕРИП" };
const ST: Record<string, string> = { DRAWER: "в кассе, не зачислено", POSTED: "на балансе", VOID: "отменено" };

export function TopupTab({ clubId }: { clubId: string }) {
  const [ops, setOps] = useState<any[]>([]);
  const [guestQuery, setGuestQuery] = useState("");
  const [guests, setGuests] = useState<any[]>([]);
  const [form, setForm] = useState({
    amount: "20",
    method: "CASH",
    receiptNo: "",
    guestName: "",
    guestPhone: "",
    userId: "",
  });
  const [post, setPost] = useState({ opId: "", userId: "", guestName: "", guestPhone: "" });
  const [msg, setMsg] = useState("");

  async function load() {
    setOps(await api(`/api/v1/clubs/${clubId}/cash-ops`));
  }
  useEffect(() => {
    load().catch((e) => setMsg(translate(e.message)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  useEffect(() => {
    if (guestQuery.length < 2) return;
    const t = setTimeout(() => {
      api<any[]>(`/api/v1/clubs/${clubId}/guests?q=${encodeURIComponent(guestQuery)}`)
        .then(setGuests)
        .catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [guestQuery, clubId]);

  const kop = (v: string) => Math.round(Number(v.replace(",", ".")) * 100);
  const field = "mt-1 min-h-11 w-full rounded-[3px] bg-void px-3 text-fog";

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

  const pending = ops.filter((o) => o.status === "DRAWER");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="display text-[40px] text-ink">Пополнение баланса</h2>
        <p className="mt-2 max-w-xl text-sm text-dim">
          Сначала гость платит на кассовом аппарате. Затем администратор заносит чек сюда и зачисляет сумму на баланс.
          Windows-агент кассы подключится позже — сейчас запись вручную с сайта.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-[6px] bg-velvet p-5">
          <h3 className="font-display text-xl text-paper">1. Приём в кассу</h3>
          <p className="mt-1 text-sm text-mute">Деньги уже прошли через кассовое оборудование. Баланс ещё не меняется.</p>
          <label className="mt-4 block text-sm text-mute" htmlFor="ta">
            Сумма, Br
          </label>
          <input id="ta" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={field} />
          <label className="mt-3 block text-sm text-mute" htmlFor="tm">
            Способ
          </label>
          <select id="tm" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className={field}>
            <option value="CASH">Наличные</option>
            <option value="CARD">Карта на кассе</option>
            <option value="ERIP">ЕРИП</option>
          </select>
          <label className="mt-3 block text-sm text-mute" htmlFor="tr">
            Номер чека
          </label>
          <input id="tr" value={form.receiptNo} onChange={(e) => setForm({ ...form, receiptNo: e.target.value })} className={field} placeholder="с кассового аппарата" />
          <label className="mt-3 block text-sm text-mute" htmlFor="tn">
            Имя гостя
          </label>
          <input id="tn" value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value, userId: "" })} className={field} placeholder="Никита, тест…" />
          <label className="mt-3 block text-sm text-mute" htmlFor="tq">
            Найти в базе
          </label>
          <input
            id="tq"
            value={guestQuery}
            onChange={(e) => setGuestQuery(e.target.value)}
            className={field}
            placeholder="телефон или имя — не обязательно"
          />
          {guests.length > 0 && guestQuery.length >= 2 && (
            <ul className="mt-1 max-h-36 overflow-auto rounded-[3px] bg-void text-sm">
              {guests.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    className="flex w-full justify-between px-3 py-2 text-left hover:bg-velvet"
                    onClick={() => {
                      setForm({ ...form, userId: g.id, guestName: g.displayName });
                      setGuestQuery(`${g.displayName} · ${phoneLabel(g.phone, g.walkIn)}`);
                      setGuests([]);
                    }}
                  >
                    <span>
                      {g.displayName} · {phoneLabel(g.phone, g.walkIn)}
                    </span>
                    <span className="text-coral">{formatByn(g.balanceKopecks)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Btn
              tone="primary"
              disabled={!form.amount || Number(form.amount.replace(",", ".")) <= 0}
              onClick={() =>
                act("Чек принят в кассу. Теперь зачислите на баланс.", () =>
                  api(`/api/v1/clubs/${clubId}/cash-ops`, {
                    method: "POST",
                    body: JSON.stringify({
                      amountKopecks: kop(form.amount),
                      method: form.method,
                      receiptNo: form.receiptNo || undefined,
                      guestName: form.guestName || undefined,
                      userId: form.userId || undefined,
                    }),
                  }),
                )
              }
            >
              Принять в кассу
            </Btn>
          </div>
        </section>

        <section className="rounded-[6px] bg-velvet p-5">
          <h3 className="font-display text-xl text-paper">2. Зачислить на баланс</h3>
          <p className="mt-1 text-sm text-mute">Очередь чеков, которые ещё не попали на кошелёк гостя.</p>
          <ul className="mt-4 divide-y divide-white/10 text-sm">
            {pending.map((o) => (
              <li key={o.id} className="py-3">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="text-paper">{formatByn(o.amountKopecks)}</p>
                    <p className="text-xs text-mute">
                      {METHOD[o.method]} {o.receiptNo ? `· чек ${o.receiptNo}` : ""} {o.guestName ? `· ${o.guestName}` : ""}
                    </p>
                  </div>
                  <button type="button" className="text-coral" onClick={() => setPost({ opId: o.id, userId: o.userId ?? "", guestName: o.guestName ?? "", guestPhone: "" })}>
                    Выбрать
                  </button>
                </div>
              </li>
            ))}
            {pending.length === 0 && <li className="py-4 text-mute">Пусто — сначала примите чек слева.</li>}
          </ul>
          {post.opId && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <label className="block text-sm text-mute" htmlFor="pn">
                Имя для зачисления
              </label>
              <input id="pn" value={post.guestName} onChange={(e) => setPost({ ...post, guestName: e.target.value, userId: "" })} className={field} placeholder="Никита" />
              <label className="mt-3 block text-sm text-mute" htmlFor="pp">
                Телефон (необязательно)
              </label>
              <input id="pp" value={post.guestPhone} onChange={(e) => setPost({ ...post, guestPhone: e.target.value })} className={field} placeholder="+375…" />
              <div className="mt-4 flex flex-wrap gap-2">
                <Btn
                  tone="primary"
                  disabled={!post.userId && !post.guestName.trim()}
                  onClick={() =>
                    act("Зачислено на баланс", () =>
                      api(`/api/v1/clubs/${clubId}/cash-ops/${post.opId}/post`, {
                        method: "POST",
                        body: JSON.stringify({
                          userId: post.userId || undefined,
                          guestName: post.guestName || undefined,
                          guestPhone: post.guestPhone || undefined,
                        }),
                      }),
                    )
                  }
                >
                  Зачислить
                </Btn>
                <Btn
                  onClick={() =>
                    act("Чек отменён", () => api(`/api/v1/clubs/${clubId}/cash-ops/${post.opId}/void`, { method: "POST", body: "{}" }))
                  }
                >
                  Отменить чек
                </Btn>
              </div>
            </div>
          )}
        </section>
      </div>

      <section>
        <h3 className="font-display text-xl text-paper">Журнал кассы</h3>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-mute">
            <tr>
              <th className="py-2 font-normal">Когда</th>
              <th className="py-2 font-normal">Сумма</th>
              <th className="py-2 font-normal">Гость</th>
              <th className="py-2 font-normal">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {ops.map((o) => (
              <tr key={o.id}>
                <td className="py-2 text-fog">{new Date(o.createdAt).toLocaleString("ru-BY")}</td>
                <td className="py-2 text-paper">{formatByn(o.amountKopecks)}</td>
                <td className="py-2 text-fog">{o.guestName || o.user?.displayName || "—"}</td>
                <td className="py-2 text-fog">{ST[o.status] ?? o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {msg && (
        <p className="text-sm text-coral" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
