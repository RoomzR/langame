"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatByn } from "@/lib/money";
import { Btn, translate } from "./hall-tab";

const STATUS: Record<string, string> = {
  PENDING: "новый",
  PAID: "оплачен",
  PREPARING: "готовится",
  READY: "готов",
  DELIVERED: "выдан",
  CANCELLED: "отменён",
};

export function CashTab({ clubId }: { clubId: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [seats, setSeats] = useState<any[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [seatId, setSeatId] = useState("");
  const [guestQuery, setGuestQuery] = useState("");
  const [guests, setGuests] = useState<any[]>([]);
  const [userId, setUserId] = useState("");
  const [newProduct, setNewProduct] = useState({ name: "", price: "", category: "bar" });
  const [msg, setMsg] = useState("");
  const [orderQuery, setOrderQuery] = useState("");

  async function load() {
    const [p, o, s] = await Promise.all([
      api<any[]>(`/api/v1/clubs/${clubId}/products`),
      api<any[]>(`/api/v1/clubs/${clubId}/orders`),
      api<any[]>(`/api/v1/clubs/${clubId}/seat-map`),
    ]);
    setProducts(p);
    setOrders(o);
    setSeats(s);
  }
  useEffect(() => {
    load().catch((e) => setMsg(translate(e.message)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  useEffect(() => {
    if (guestQuery.length < 2) return;
    const t = setTimeout(() => api<any[]>(`/api/v1/clubs/${clubId}/guests?q=${encodeURIComponent(guestQuery)}`).then(setGuests).catch(() => undefined), 250);
    return () => clearTimeout(t);
  }, [guestQuery, clubId]);

  useEffect(() => {
    const seat = seats.find((s) => s.id === seatId);
    if (seat?.sessionId && seat.guestName) {
      setGuestQuery(seat.guestName);
    }
  }, [seatId, seats]);

  const total = Object.entries(cart).reduce((s, [id, qty]) => s + (products.find((p) => p.id === id)?.priceKopecks ?? 0) * qty, 0);

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

  async function sell() {
    const seat = seats.find((s) => s.id === seatId);
    const buyer = userId || undefined;
    await act(`Продано на ${formatByn(total)}`, () =>
      api(`/api/v1/clubs/${clubId}/orders`, {
        method: "POST",
        body: JSON.stringify({
          items: Object.entries(cart).map(([productId, qty]) => ({ productId, qty })),
          seatId: seatId || undefined,
          userId: buyer ?? (seat?.sessionId ? undefined : undefined),
        }),
      }),
    );
    setCart({});
  }

  const categories = Array.from(new Set(products.map((p) => p.category)));

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div>
        {categories.map((c) => (
          <section key={c} className="mt-2">
            <h3 className="text-sm text-mute">{c === "bar" ? "Бар" : c === "merch" ? "Мерч" : c}</h3>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {products
                .filter((p) => p.category === c)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setCart({ ...cart, [p.id]: (cart[p.id] ?? 0) + 1 })}
                    className="min-h-20 rounded-[4px] bg-velvet p-3 text-left hover:bg-velvet/70"
                  >
                    <p className="text-paper">{p.name}</p>
                    <p className="mt-1 text-sm text-coral">{formatByn(p.priceKopecks)}</p>
                    {cart[p.id] && <p className="mt-1 text-xs text-fog">в чеке: {cart[p.id]}</p>}
                  </button>
                ))}
            </div>
          </section>
        ))}
        <section className="mt-8 border-t border-white/10 pt-6">
          <h3 className="font-display text-xl text-paper">Добавить товар</h3>
          <div className="mt-3 grid grid-cols-[1fr_100px_120px_auto] gap-2">
            <input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Название" className="min-h-11 rounded-[3px] bg-velvet px-3 text-fog" aria-label="Название" />
            <input value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} placeholder="Br" className="min-h-11 rounded-[3px] bg-velvet px-3 text-fog" aria-label="Цена, Br" />
            <select value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} className="min-h-11 rounded-[3px] bg-velvet px-3 text-fog" aria-label="Категория">
              <option value="bar">Бар</option>
              <option value="merch">Мерч</option>
              <option value="service">Услуга</option>
            </select>
            <Btn
              disabled={!newProduct.name || !newProduct.price}
              onClick={() =>
                act("Товар добавлен", () =>
                  api(`/api/v1/clubs/${clubId}/products`, {
                    method: "POST",
                    body: JSON.stringify({ name: newProduct.name, priceKopecks: Math.round(Number(newProduct.price.replace(",", ".")) * 100), category: newProduct.category }),
                  }),
                )
              }
            >
              Добавить
            </Btn>
          </div>
        </section>
        <section className="mt-8">
          <h3 className="font-display text-xl text-paper">Заказы</h3>
          <input
            value={orderQuery}
            onChange={(e) => setOrderQuery(e.target.value)}
            placeholder="Телефон или имя гостя"
            className="mt-3 min-h-11 w-full rounded-[4px] bg-velvet px-3 text-sm text-fog"
            aria-label="Поиск заказа"
          />
          <ul className="mt-3 divide-y divide-white/10 text-sm">
            {orders
              .filter((o) => {
                const q = orderQuery.trim().toLowerCase();
                if (!q) return true;
                return `${o.user?.displayName ?? ""} ${o.user?.phone ?? ""}`.toLowerCase().includes(q);
              })
              .slice(0, 30)
              .map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <span className="text-paper">{o.items.map((i: any) => `${i.product?.name} ×${i.qty}`).join(", ")}</span>
                  <div className="text-xs text-mute">
                    {o.user?.displayName} · {new Date(o.createdAt).toLocaleTimeString("ru-BY", { hour: "2-digit", minute: "2-digit" })} · {formatByn(o.totalKopecks)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-fog">{STATUS[o.status] ?? o.status}</span>
                  {o.status !== "DELIVERED" && o.status !== "CANCELLED" && (
                    <button type="button" className="link-coral" onClick={() => act("Заказ выдан", () => api(`/api/v1/clubs/${clubId}/orders/${o.id}/status`, { method: "POST", body: JSON.stringify({ status: "DELIVERED" }) }))}>
                      Выдан
                    </button>
                  )}
                </div>
              </li>
            ))}
            {orders.length === 0 && <li className="py-3 text-mute">Заказов ещё не было.</li>}
          </ul>
        </section>
      </div>

      <aside className="panel-hud p-5 lg:sticky lg:top-24 lg:self-start">
        <h3 className="font-display text-xl text-ink">Чек</h3>
        <ul className="mt-3 divide-y divide-line text-sm">
          {Object.entries(cart).map(([id, qty]) => {
            const p = products.find((x) => x.id === id);
            if (!p) return null;
            return (
              <li key={id} className="flex items-center justify-between py-2">
                <span>
                  {p.name} × {qty}
                </span>
                <span className="flex items-center gap-3">
                  {formatByn(p.priceKopecks * qty)}
                  <button type="button" aria-label="Убрать" className="text-dim" onClick={() => setCart({ ...cart, [id]: qty - 1 > 0 ? qty - 1 : 0 })}>
                    −
                  </button>
                </span>
              </li>
            );
          })}
          {total === 0 && <li className="py-2 text-dim">Нажимайте на товары слева.</li>}
        </ul>
        <p className="mt-3 flex justify-between font-display text-2xl text-ink">
          <span>Итого</span>
          <span className="text-coral">{formatByn(total)}</span>
        </p>
        <label className="mt-4 block text-sm text-dim" htmlFor="cs">
          На ПК (доставка к месту)
        </label>
        <select id="cs" value={seatId} onChange={(e) => setSeatId(e.target.value)} className="field-hud mt-1">
          <option value="">Со стойки</option>
          {seats.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} {s.guestName ? `· ${s.guestName}` : ""}
            </option>
          ))}
        </select>
        <label className="mt-3 block text-sm text-dim" htmlFor="cg">
          Списать с баланса гостя
        </label>
        <input id="cg" value={guestQuery} onChange={(e) => setGuestQuery(e.target.value)} placeholder="телефон или имя" className="field-hud mt-1" />
        {guests.length > 0 && guestQuery.length >= 2 && (
          <ul className="mt-1 max-h-36 overflow-auto border border-line bg-base text-sm">
            {guests.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  className="flex w-full justify-between px-3 py-2 text-left hover:bg-elevated"
                  onClick={() => {
                    setUserId(g.id);
                    setGuestQuery(`${g.displayName} · ${g.phone}`);
                    setGuests([]);
                  }}
                >
                  <span>{g.displayName}</span>
                  <span>{formatByn(g.balanceKopecks)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" disabled={total === 0 || !userId} onClick={sell} className="btn-hud mt-4 w-full disabled:opacity-40">
          Продать
        </button>
        {!userId && total > 0 && <p className="mt-2 text-xs text-dim">Выберите гостя — списание идёт с его баланса.</p>}
        {msg && (
          <p className="mt-3 text-sm" role="status">
            {msg}
          </p>
        )}
      </aside>
    </div>
  );
}
