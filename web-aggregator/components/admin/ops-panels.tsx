"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatByn } from "@/lib/money";
import { phoneLabel } from "@/lib/guest";
import { Btn, translate } from "./hall-tab";
import { ROLE_LABELS, ASSIGNABLE_CLUB_ROLES, type RoleName } from "@/lib/acl";
import { ClubSettingsTab } from "./club-settings-tab";
import { GuestsTab } from "./guests-tab";
import { CashTab } from "./cash-tab";
import { DashTab } from "./dash-tab";

const field = "mt-1 min-h-11 w-full rounded-[3px] bg-void px-3 text-fog";

export function PartnersTab() {
  return (
    <div className="max-w-lg">
      <h2 className="display text-[40px] text-ink">Партнёрам</h2>
      <p className="mt-3 text-dim">Офферы поставщиков железа, напитков и турниров появятся здесь. Пока раздел-заготовка сети RUDEMIR.</p>
    </div>
  );
}

export function HelpTab() {
  return (
    <div className="max-w-lg">
      <h2 className="display text-[40px] text-ink">Помощь</h2>
      <p className="mt-3 text-dim">Смена: касса → зачисление на баланс → бронь. Гостя без аккаунта можно записать по имени.</p>
      <p className="mt-4 text-sm text-dim">Поддержка сети: +375 29 100-00-01 · Минск, UTC+3</p>
    </div>
  );
}

export function TariffsTab({ clubId, club, onSaved }: { clubId: string; club: any; onSaved?: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("12");
  const [hw, setHw] = useState({ name: "", cpu: "", gpu: "" });
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api<any[]>(`/api/v1/clubs/${clubId}/hardware`).then(setRows).catch(() => undefined);
  }, [clubId]);

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <ClubSettingsTab clubId={clubId} club={club} onSaved={onSaved} />
      <div>
        <h2 className="display text-[40px] text-ink">Тарифы</h2>
        <ul className="mt-4 text-sm text-dim">
          {club?.tariffs?.map((t: any) => (
            <li key={t.id} className="py-2">
              {t.name} · {formatByn(t.pricePerHourKopecks)}/ч
            </li>
          ))}
        </ul>
        <div className="mt-4 grid grid-cols-[1fr_100px_auto] gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" className={field} aria-label="Тариф" />
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Br/ч" className={field} aria-label="Цена" />
          <Btn
            tone="primary"
            disabled={!name}
            onClick={async () => {
              setMsg("");
              try {
                await api(`/api/v1/clubs/${clubId}/tariffs`, {
                  method: "POST",
                  body: JSON.stringify({ name, pricePerHourKopecks: Math.round(Number(price.replace(",", ".")) * 100) }),
                });
                setMsg("Тариф добавлен");
                onSaved?.();
              } catch (e: any) {
                setMsg(translate(e.message));
              }
            }}
          >
            Добавить
          </Btn>
        </div>
        <h3 className="mt-10 font-display text-xl text-paper">Железо</h3>
        <ul className="mt-2 text-sm text-dim">
          {rows.map((h) => (
            <li key={h.id}>
              {h.name} · {h.cpu} {h.gpu}
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-2">
          <input value={hw.name} onChange={(e) => setHw({ ...hw, name: e.target.value })} placeholder="Профиль" className={field} />
          <input value={hw.cpu} onChange={(e) => setHw({ ...hw, cpu: e.target.value })} placeholder="CPU" className={field} />
          <input value={hw.gpu} onChange={(e) => setHw({ ...hw, gpu: e.target.value })} placeholder="GPU" className={field} />
          <Btn
            disabled={!hw.name}
            onClick={async () => {
              setMsg("");
              try {
                await api(`/api/v1/clubs/${clubId}/hardware`, { method: "POST", body: JSON.stringify(hw) });
                setRows(await api(`/api/v1/clubs/${clubId}/hardware`));
                setMsg("Профиль железа сохранён");
              } catch (e: any) {
                setMsg(translate(e.message));
              }
            }}
          >
            Сохранить железо
          </Btn>
        </div>
        {msg && <p className="mt-3 text-sm text-coral">{msg}</p>}
      </div>
    </div>
  );
}

export function StaffTab({ clubId }: { clubId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ displayName: "", phone: "+375", password: "", role: "CLUB_ADMIN" });
  const [msg, setMsg] = useState("");

  async function load() {
    setRows(await api(`/api/v1/clubs/${clubId}/staff`));
  }
  useEffect(() => {
    load().catch((e) => setMsg(translate(e.message)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <h2 className="display text-[40px] text-ink">Сотрудники</h2>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-mute">
            <tr>
              <th className="py-2 font-normal">Имя</th>
              <th className="py-2 font-normal">Телефон</th>
              <th className="py-2 font-normal">Роль</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="py-3 text-paper">{r.user?.displayName}</td>
                <td className="py-3 text-fog">{r.user?.phone}</td>
                <td className="py-3 text-fog">{ROLE_LABELS[r.role as RoleName] ?? r.role}</td>
                <td className="py-3 text-right">
                  <button
                    type="button"
                    className="text-mute hover:text-coral"
                    onClick={async () => {
                      await api(`/api/v1/clubs/${clubId}/staff/${r.userId}`, { method: "DELETE" });
                      await load();
                    }}
                  >
                    Снять
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <aside className="rounded-[6px] bg-velvet p-5">
        <h3 className="font-display text-xl text-paper">Новый сотрудник</h3>
        <input className={`${field} mt-4`} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Имя" aria-label="Имя" />
        <input className={`${field} mt-3`} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Телефон" aria-label="Телефон" />
        <input className={`${field} mt-3`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Пароль" aria-label="Пароль" />
        <select className={`${field} mt-3`} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} aria-label="Роль">
          {ASSIGNABLE_CLUB_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <div className="mt-4">
          <Btn
            tone="primary"
            disabled={!form.displayName || form.password.length < 6}
            onClick={async () => {
              setMsg("");
              try {
                await api(`/api/v1/clubs/${clubId}/staff`, { method: "POST", body: JSON.stringify(form) });
                setMsg("Сотрудник добавлен");
                await load();
              } catch (e: any) {
                setMsg(translate(e.message));
              }
            }}
          >
            Добавить
          </Btn>
        </div>
        {msg && <p className="mt-3 text-sm text-coral">{msg}</p>}
      </aside>
    </div>
  );
}

export function AccountsTab({ clubId }: { clubId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ guestName: "", platform: "steam", login: "", note: "" });
  const [msg, setMsg] = useState("");

  async function load() {
    setRows(await api(`/api/v1/clubs/${clubId}/game-accounts`));
  }
  useEffect(() => {
    load().catch((e) => setMsg(translate(e.message)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  return (
    <div>
      <h2 className="display text-[40px] text-ink">Игровые аккаунты</h2>
      <div className="mt-6 grid gap-2 md:grid-cols-4">
        <input className={field} value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} placeholder="Гость" />
        <select className={field} value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
          <option value="steam">Steam</option>
          <option value="discord">Discord</option>
          <option value="riot">Riot</option>
        </select>
        <input className={field} value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} placeholder="Логин" />
        <Btn
          tone="primary"
          disabled={!form.guestName || !form.login}
          onClick={async () => {
            await api(`/api/v1/clubs/${clubId}/game-accounts`, { method: "POST", body: JSON.stringify(form) });
            setMsg("Аккаунт сохранён");
            await load();
          }}
        >
          Сохранить
        </Btn>
      </div>
      <ul className="mt-6 divide-y divide-white/10 text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex justify-between py-3">
            <span>
              {r.guestName} · {r.platform} · {r.login}
            </span>
            <button
              type="button"
              className="text-mute"
              onClick={async () => {
                await api(`/api/v1/clubs/${clubId}/game-accounts/${r.id}`, { method: "DELETE" });
                await load();
              }}
            >
              Удалить
            </button>
          </li>
        ))}
      </ul>
      {msg && <p className="mt-3 text-sm text-coral">{msg}</p>}
    </div>
  );
}

export function NewsTab({ clubId }: { clubId: string }) {
  const [form, setForm] = useState({ title: "", excerpt: "", body: "" });
  const [list, setList] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api<any[]>("/api/v1/news").then(setList).catch(() => undefined);
  }, [clubId]);

  return (
    <div className="max-w-xl">
      <h2 className="display text-[40px] text-ink">Новости</h2>
      <input className={`${field} mt-6`} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Заголовок" />
      <input className={`${field} mt-3`} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} placeholder="Коротко" />
      <textarea className={`${field} mt-3 min-h-28 py-3`} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Текст" />
      <div className="mt-4">
        <Btn
          tone="primary"
          disabled={!form.title}
          onClick={async () => {
            await api(`/api/v1/clubs/${clubId}/news`, { method: "POST", body: JSON.stringify(form) });
            setMsg("Опубликовано");
            setList(await api("/api/v1/news"));
          }}
        >
          Опубликовать
        </Btn>
      </div>
      <ul className="mt-8 divide-y divide-white/10 text-sm">
        {list.map((n) => (
          <li key={n.id} className="py-3">
            <p className="text-paper">{n.title}</p>
            <p className="text-mute">{n.excerpt}</p>
          </li>
        ))}
      </ul>
      {msg && <p className="mt-3 text-sm text-coral">{msg}</p>}
    </div>
  );
}

export function MailTab({ clubId }: { clubId: string }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <div className="max-w-lg">
      <h2 className="display text-[40px] text-ink">Рассылки</h2>
      <p className="mt-2 text-sm text-dim">Уйдёт гостям клуба с телефоном. Walk-in без номера пропускаются.</p>
      <input className={`${field} mt-6`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Тема" />
      <textarea className={`${field} mt-3 min-h-28 py-3`} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Текст" />
      <div className="mt-4">
        <Btn
          tone="primary"
          disabled={!title || !body}
          onClick={async () => {
            const res = await api<{ sent: number }>(`/api/v1/clubs/${clubId}/mailings`, { method: "POST", body: JSON.stringify({ title, body }) });
            setMsg(`Отправлено: ${res.sent}`);
          }}
        >
          Отправить
        </Btn>
      </div>
      {msg && <p className="mt-3 text-sm text-coral">{msg}</p>}
    </div>
  );
}

const MODULES = [
  { id: "tournaments", label: "Турниры" },
  { id: "lockers", label: "Локеры" },
  { id: "bar", label: "Бар" },
  { id: "mail", label: "Рассылки" },
];

export function ModulesTab({ clubId, club, onSaved }: { clubId: string; club: any; onSaved?: () => void }) {
  const current = (club?.modules ?? {}) as Record<string, boolean>;
  const [mods, setMods] = useState<Record<string, boolean>>(current);
  const [msg, setMsg] = useState("");
  useEffect(() => setMods((club?.modules ?? {}) as Record<string, boolean>), [club]);
  return (
    <div className="max-w-lg">
      <h2 className="display text-[40px] text-ink">Модули</h2>
      <ul className="mt-6 space-y-3">
        {MODULES.map((m) => (
          <li key={m.id}>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={mods[m.id] !== false}
                onChange={(e) => setMods({ ...mods, [m.id]: e.target.checked })}
              />
              {m.label}
            </label>
          </li>
        ))}
      </ul>
      <Btn
        tone="primary"
        onClick={async () => {
          await api(`/api/v1/clubs/${clubId}/modules`, { method: "PATCH", body: JSON.stringify({ modules: mods }) });
          setMsg("Сохранено");
          onSaved?.();
        }}
      >
        Сохранить
      </Btn>
      {msg && <p className="mt-3 text-sm text-coral">{msg}</p>}
    </div>
  );
}

export function TechTab({ clubId }: { clubId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    api<any>(`/api/v1/clubs/${clubId}/analytics/occupancy`)
      .then((d) => setRows(Array.isArray(d) ? d : d?.hours ?? d?.points ?? d?.buckets ?? []))
      .catch(() => undefined);
  }, [clubId]);
  return (
    <div>
      <h2 className="display text-[40px] text-ink">Техстатистика</h2>
      <p className="mt-2 text-sm text-dim">Загрузка зала за сутки. Windows-агент позже отдаст телеметрию ПК.</p>
      <ul className="mt-6 text-sm text-fog">
        {rows.slice(0, 24).map((r, i) => (
          <li key={i} className="flex justify-between border-b border-white/10 py-2">
            <span>{r.hour ?? r.label ?? r.date ?? i}</span>
            <span>{r.occupancyPct ?? r.busy ?? r.value ?? "—"}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="text-mute">Пока нет точек — зал только открылся.</li>}
      </ul>
    </div>
  );
}

export function DevicesTab({ clubId }: { clubId: string }) {
  const [seats, setSeats] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    api<any[]>(`/api/v1/clubs/${clubId}/seat-map`).then(setSeats).catch((e) => setMsg(translate(e.message)));
  }, [clubId]);
  return (
    <div>
      <h2 className="display text-[40px] text-ink">Устройства</h2>
      <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {seats.map((s) => (
          <div key={s.id} className="rounded-[6px] bg-velvet p-4">
            <p className="text-paper">{s.label}</p>
            <p className="text-xs text-mute">{s.currentProcess || s.status}</p>
            <div className="mt-3 flex gap-2">
              {["reboot", "lock", "unlock"].map((cmd) => (
                <button
                  key={cmd}
                  type="button"
                  className="text-sm text-coral"
                  onClick={async () => {
                    await api(`/api/v1/clubs/${clubId}/seats/${s.id}/command`, { method: "POST", body: JSON.stringify({ command: cmd }) });
                    setMsg(`${s.label}: ${cmd}`);
                  }}
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {msg && <p className="mt-3 text-sm text-coral">{msg}</p>}
    </div>
  );
}

export function CardsTab({ clubId }: { clubId: string }) {
  return <GuestsTab clubId={clubId} />;
}

export function ProductsTab({ clubId }: { clubId: string }) {
  return <CashTab clubId={clubId} />;
}

export function AnalyticsPanel({ clubId, isSuper }: { clubId: string; isSuper: boolean }) {
  return <DashTab clubId={clubId} isSuper={isSuper} />;
}
