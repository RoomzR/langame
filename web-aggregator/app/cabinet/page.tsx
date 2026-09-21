"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatByn } from "@/lib/money";
import { EmptyState, ErrorBanner, Skeleton } from "@/components/hud-states";

const BOOKING_RU: Record<string, string> = {
  PENDING: "ожидает",
  CONFIRMED: "подтверждена",
  CANCELLED: "отменена",
  COMPLETED: "сыграна",
  NO_SHOW: "не пришли",
};

export default function CabinetPage() {
  const [me, setMe] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState("15");
  const [method, setMethod] = useState<"bepaid" | "erip">("bepaid");
  const [pending, setPending] = useState<any>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"play" | "wallet" | "people" | "profile">("play");

  async function load() {
    const user = await api<any>("/api/v1/auth/me");
    setMe(user);
    setName(user.displayName);
    const [b, s, t, n, f, a, c] = await Promise.all([
      api<any[]>("/api/v1/me/bookings").catch(() => []),
      api<any[]>("/api/v1/me/sessions").catch(() => []),
      api<any[]>("/api/v1/me/transactions").catch(() => []),
      api<any[]>("/api/v1/notifications").catch(() => []),
      api<any[]>("/api/v1/me/friends").catch(() => []),
      api<any[]>("/api/v1/me/achievements").catch(() => []),
      api<any[]>("/api/v1/achievements").catch(() => []),
    ]);
    setBookings(b);
    setSessions(s);
    setTxns(t);
    setNotes(n);
    setFriends(f);
    setAchievements(a);
    setCatalog(c);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function run(label: string, fn: () => Promise<unknown>) {
    setMsg("");
    try {
      await fn();
      if (label) setMsg(label);
      await load();
    } catch (e: any) {
      setMsg(String(e.message));
    }
  }

  async function checkout() {
    const kopecks = Math.round(Number(amount.replace(",", ".")) * 100);
    const res = await api<any>("/api/v1/payments/checkout", { method: "POST", body: JSON.stringify({ amountKopecks: kopecks, method }) });
    setPending(res);
  }

  if (error) {
    return error === "UNAUTHORIZED" ? (
      <div className="auth-stage">
        <div className="auth-copy">
          <h1 className="display text-[72px] text-white md:text-[120px]">Кабинет</h1>
          <p className="mt-6 max-w-[22rem] text-lg text-white/75">Войти, чтобы видеть бронь, сессии и баланс в Br.</p>
          <Link href="/login" className="btn-hud mt-8">
            Войти
          </Link>
        </div>
      </div>
    ) : (
      <ErrorBanner onRetry={() => load().catch((e) => setError(e.message))} />
    );
  }
  if (!me) return <Skeleton className="h-64" />;

  const upcoming = bookings.filter((b) => (b.status === "CONFIRMED" || b.status === "PENDING") && new Date(b.endsAt) > new Date());

  return (
    <div>
      <div className="grid gap-6 md:grid-cols-[2fr_1fr] md:items-end">
        <div>
          <h1 className="display text-[56px] text-ink md:text-[96px]">{me.displayName}</h1>
          <p className="mono mt-2 text-xs uppercase text-dim">{me.phone}</p>
        </div>
        <div className="glass rounded-[4px] px-6 py-5">
          <p className="text-sm text-dim">Баланс</p>
          <p className="display text-[48px] text-coral">{formatByn(me.wallet?.balanceKopecks ?? 0)}</p>
          {me.wallet?.bonusKopecks > 0 && <p className="mt-1 text-xs text-dim">+ {formatByn(me.wallet.bonusKopecks)} бонусами</p>}
        </div>
      </div>

      <nav className="mt-8 flex flex-wrap gap-1.5">
        {(
          [
            ["play", "Игра"],
            ["wallet", "Баланс"],
            ["people", "Друзья"],
            ["profile", "Профиль"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`min-h-11 rounded-[4px] px-5 text-sm font-semibold ${tab === id ? "bg-accent text-ink" : "bg-white/5 text-dim hover:bg-white/10"}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {msg && (
        <p className="mt-4 text-sm text-coral" role="status">
          {msg}
        </p>
      )}

      {tab === "play" && (
        <div className="mt-8 grid gap-10 md:grid-cols-[2fr_1fr]">
          <section>
            <h2 className="display text-[36px] text-ink">Брони</h2>
            <ul className="mt-4 divide-y divide-line">
              {upcoming.map((b) => (
                <li key={b.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="text-ink">
                      {b.club?.name} · {b.seat?.label}
                    </p>
                    <p className="text-dim">
                      {new Date(b.startsAt).toLocaleString("ru-BY", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} —{" "}
                      {new Date(b.endsAt).toLocaleTimeString("ru-BY", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <button type="button" className="text-dim hover:text-coral" onClick={() => run("Бронь отменена", () => api(`/api/v1/bookings/${b.id}/cancel`, { method: "POST", body: "{}" }))}>
                    Отмена
                  </button>
                </li>
              ))}
              {upcoming.length === 0 && (
                <li>
                  <EmptyState text="Броней нет" href="/#clubs" action="Клубы" />
                </li>
              )}
            </ul>
            <h2 className="display mt-10 text-[36px] text-ink">История</h2>
            <ul className="mt-4 divide-y divide-line text-sm">
              {bookings
                .filter((b) => !upcoming.includes(b))
                .slice(0, 10)
                .map((b) => (
                  <li key={b.id} className="py-2 text-dim">
                    {new Date(b.startsAt).toLocaleDateString("ru-BY")} · {b.club?.name} · {b.seat?.label} · {BOOKING_RU[b.status] ?? b.status}
                  </li>
                ))}
            </ul>
          </section>
          <section>
            <h2 className="display text-[36px] text-ink">Сессии</h2>
            <ul className="mt-4 divide-y divide-line text-sm">
              {sessions.slice(0, 10).map((s) => (
                <li key={s.id} className="flex justify-between py-3">
                  <span className="text-dim">
                    {new Date(s.startedAt).toLocaleDateString("ru-BY")} · {s.club?.name} · {s.seat?.label}
                    {s.status !== "ENDED" && <span className="ml-2 text-accent">идёт</span>}
                  </span>
                  <span className="text-coral">{formatByn(s.totalChargedKopecks)}</span>
                </li>
              ))}
              {sessions.length === 0 && (
                <li>
                  <EmptyState text="Сессий нет" />
                </li>
              )}
            </ul>
            <h2 className="display mt-10 text-[36px] text-ink">Достижения</h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {catalog.map((a) => {
                const has = achievements.some((x) => x.id === a.id);
                return (
                  <li key={a.id} className={`rounded-xl p-4 ${has ? "glass" : "border border-dashed border-line text-dim"}`}>
                    <p className={has ? "text-ink" : ""}>{a.name}</p>
                    <p className="text-xs text-dim">{a.description}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}

      {tab === "wallet" && (
        <div className="mt-8 grid gap-10 md:grid-cols-[2fr_1fr]">
          <section className="panel-hud p-6">
            <h2 className="display text-[36px] text-ink">Пополнить</h2>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {["5", "10", "20", "50"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(v)}
                  className={`min-h-11 rounded-md text-sm font-semibold ${amount === v ? "bg-accent text-ink" : "bg-white/5 text-dim hover:bg-white/10"}`}
                >
                  {v} Br
                </button>
              ))}
            </div>
            <label className="mt-3 block text-sm text-dim" htmlFor="sum">
              Другая сумма, Br
            </label>
            <input id="sum" value={amount} onChange={(e) => setAmount(e.target.value)} className="field-hud mt-1" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMethod("bepaid")}
                className={`min-h-11 rounded-md text-sm font-semibold ${method === "bepaid" ? "bg-accent text-ink" : "bg-white/5 text-dim hover:bg-white/10"}`}
              >
                Карта (bePaid)
              </button>
              <button
                type="button"
                onClick={() => setMethod("erip")}
                className={`min-h-11 rounded-md text-sm font-semibold ${method === "erip" ? "bg-accent text-ink" : "bg-white/5 text-dim hover:bg-white/10"}`}
              >
                ЕРИП
              </button>
            </div>
            <button type="button" onClick={() => run("", checkout)} className="btn-hud mt-4 w-full">
              Оплата
            </button>
            {pending && (
              <div className="mt-4 rounded-xl bg-white/5 p-4 text-sm text-dim">
                <p className="font-medium text-ink">{pending.amountLabel}</p>
                <p className="mt-1">{pending.instruction}</p>
                {pending.eripCode && <p className="display mt-1 text-[32px] text-coral">{pending.eripCode}</p>}
                <button
                  type="button"
                  className="btn-hud mt-3 w-full min-h-11"
                  onClick={() =>
                    run("Баланс пополнен", async () => {
                      await api(`/api/v1/payments/${pending.paymentId}/sandbox-complete`, { method: "POST", body: "{}" });
                      setPending(null);
                    })
                  }
                >
                  Я оплатил (песочница)
                </button>
              </div>
            )}
            {me.wallet?.bonusKopecks > 0 && (
              <button type="button" className="mt-4 text-sm link-coral" onClick={() => run("Бонусы переведены на баланс", () => api("/api/v1/me/wallet/redeem-bonus", { method: "POST", body: "{}" }))}>
                Перевести {formatByn(me.wallet.bonusKopecks)} бонусов на баланс
              </button>
            )}
          </section>
          <section>
            <h2 className="display text-[36px] text-ink">Операции</h2>
            <ul className="mt-4 divide-y divide-line text-sm">
              {txns.slice(0, 20).map((t) => (
                <li key={t.id} className="flex justify-between py-2">
                  <span className="text-dim">
                    {new Date(t.createdAt).toLocaleString("ru-BY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {t.description}
                  </span>
                  <span className={t.amountKopecks >= 0 ? "text-accent" : "text-dim"}>
                    {t.amountKopecks >= 0 ? "+" : ""}
                    {formatByn(t.amountKopecks)}
                  </span>
                </li>
              ))}
              {txns.length === 0 && <li className="py-2 text-dim">Операций пока нет.</li>}
            </ul>
          </section>
        </div>
      )}

      {tab === "people" && (
        <div className="mt-8 grid gap-10 md:grid-cols-[2fr_1fr]">
          <section>
            <label className="block text-sm text-dim" htmlFor="friend">
              Найти по имени или телефону
            </label>
            <div className="mt-2 flex gap-2">
              <input id="friend" className="field-hud flex-1" value={query} onChange={(e) => setQuery(e.target.value)} />
              <button
                type="button"
                className="btn-hud min-h-11 px-4"
                onClick={() =>
                  run("Заявка отправлена", async () => {
                    const users = await api<any[]>(`/api/v1/users?q=${encodeURIComponent(query)}`);
                    const peer = users.find((u) => u.id !== me.id);
                    if (!peer) throw new Error("Никого не нашли по этому запросу.");
                    await api("/api/v1/me/friends", { method: "POST", body: JSON.stringify({ userId: peer.id }) });
                  })
                }
              >
                Добавить
              </button>
            </div>
            <ul className="mt-6 divide-y divide-line text-sm">
              {friends.map((f) => (
                <li key={f.id} className="flex items-center justify-between py-3">
                  <span className="text-dim">
                    <span className="text-ink">{f.peer?.displayName}</span> · {f.status === "PENDING" ? (f.incoming ? "хочет дружить" : "заявка отправлена") : f.status === "ACCEPTED" ? "друг" : "заблокирован"}
                  </span>
                  {f.incoming && f.status === "PENDING" && (
                    <span className="flex gap-3">
                      <button type="button" className="link-coral" onClick={() => run("Теперь вы друзья", () => api(`/api/v1/me/friends/${f.id}/accept`, { method: "POST", body: "{}" }))}>
                        Принять
                      </button>
                      <button type="button" className="text-dim" onClick={() => run("Заявка отклонена", () => api(`/api/v1/me/friends/${f.id}/decline`, { method: "POST", body: "{}" }))}>
                        Отклонить
                      </button>
                    </span>
                  )}
                </li>
              ))}
              {friends.length === 0 && <li className="py-3 text-dim">Пока никого. Найдите друга по телефону.</li>}
            </ul>
          </section>
          <section>
            <h2 className="display text-[36px] text-ink">Уведомления</h2>
            <ul className="mt-4 divide-y divide-line text-sm">
              {notes.slice(0, 15).map((n) => (
                <li key={n.id} className={`py-3 ${n.readAt ? "opacity-60" : ""}`}>
                  <p className="text-ink">{n.title}</p>
                  <p className="text-dim">{n.body}</p>
                </li>
              ))}
            </ul>
            {notes.some((n) => !n.readAt) && (
              <button type="button" className="mt-3 text-sm link-coral" onClick={() => run("", () => api("/api/v1/notifications/read-all", { method: "PATCH", body: "{}" }))}>
                Отметить прочитанными
              </button>
            )}
          </section>
        </div>
      )}

      {tab === "profile" && (
        <section className="mt-8 max-w-md">
          <label className="block text-sm text-dim" htmlFor="pn">
            Имя в клубе
          </label>
          <input id="pn" value={name} onChange={(e) => setName(e.target.value)} className="field-hud mt-1" />
          <button type="button" className="btn-hud mt-3 min-h-11" onClick={() => run("Имя сохранено", () => api("/api/v1/me", { method: "PATCH", body: JSON.stringify({ displayName: name }) }))}>
            Сохранить
          </button>
          <p className="mt-8 text-sm text-dim">
            Карта гостя выдаётся на стойке клуба: вход на игровом ПК по номеру карты и PIN. Смена PIN — у администратора.
          </p>
        </section>
      )}
    </div>
  );
}
