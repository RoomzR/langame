"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatByn } from "@/lib/money";
import { phoneLabel } from "@/lib/guest";
import { csvDownload, EmptyModule, EventLog, FilterBar, OpsTable, OpsTitle, SettingsBlock } from "./ops-ui";
import { ClubSettingsTab } from "./club-settings-tab";
import { GuestsTab } from "./guests-tab";
import { CashTab } from "./cash-tab";
import { HallTab } from "./hall-tab";
import { BookingsTab } from "./bookings-tab";
import { MapTab } from "./map-tab";
import { ShiftTab } from "./shift-tab";
import { TopupTab } from "./topup-tab";
import { DashTab } from "./dash-tab";
import { NetworkDash } from "./dash-network";
import { ClubDash } from "./dash-club";
import { CONSOLE_GROUPS } from "./console-nav";
import { ASSIGNABLE_CLUB_ROLES, DEFAULT_TABS, ROLE_LABELS, type RoleName } from "@/lib/acl";

const field = "ops-field";

export function PartnersTab() {
  return (
    <div className="ops-card max-w-lg">
      <h2 className="ops-h">Предложения партнёров</h2>
      <ul className="mt-4 divide-y divide-black/5 text-sm">
        <li className="py-3">HyperX / Kingston — комплекты периферии для сети, запрос через поддержку +375 29 100-00-01</li>
        <li className="py-3">Coca-Cola HBC Беларусь — барная матрица, цены в Br</li>
        <li className="py-3">ESL / локальные турниры — сетка на выходные, публикация в новостях клуба</li>
      </ul>
    </div>
  );
}

export function HelpTab() {
  return (
    <div className="ops-card max-w-2xl">
      <h2 className="ops-h">Помощь и контакты</h2>
      <p className="mt-3 text-sm text-[#444]">Смена: касса принимает чек → зачисление на баланс на сайте → бронь. Гостя без аккаунта пишите по имени, телефон не обязателен.</p>
      <p className="mt-4 text-sm">Поддержка сети: +375 29 100-00-01 · Минск, UTC+3</p>
      <ul className="mt-6 space-y-2 text-sm text-[#444]">
        <li>Гость подключается бронью, картой или walk-in на стойке — в клубе появляется связь «гость».</li>
        <li>Владелец подключает клуб через «Подключить клуб» и назначает сотрудников.</li>
        <li>Тех. админ кладёт команды Windows-агенту в очередь, без кассы.</li>
        <li>Техподдержка сети заходит в любой клуб без членства, без денег и без настроек платежей.</li>
      </ul>
    </div>
  );
}

const STAFF_ROLES: { value: RoleName; label: string }[] = ASSIGNABLE_CLUB_ROLES.map((value) => ({
  value,
  label: ROLE_LABELS[value],
}));

export function StaffList({ clubId }: { clubId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ displayName: "", phone: "+375", password: "admin123", role: "CLUB_ADMIN", login: "", workPoint: "Мой центр", schedule: "День", wage: "15" });
  const [msg, setMsg] = useState("");

  async function load() {
    setRows(await api(`/api/v1/clubs/${clubId}/staff/full?dismissed=${dismissed ? "1" : "0"}`));
  }
  useEffect(() => {
    load().catch(() => undefined);
  }, [clubId, dismissed]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" className={`ops-pill ${!dismissed ? "is-on" : ""}`} onClick={() => setDismissed(false)}>
          Работают
        </button>
        <button type="button" className={`ops-pill ${dismissed ? "is-on" : ""}`} onClick={() => setDismissed(true)}>
          Уволены
        </button>
        <input className="ops-field max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" />
        <button type="button" className="ops-pill ml-auto" onClick={() => csvDownload("staff.csv", rows)}>
          Экспорт CSV
        </button>
      </div>
      <div className="ops-card overflow-x-auto">
        <table className="ops-table">
          <thead>
            <tr>
              {["", "ID", "ФИО", "Смена открыта", "Логин", "Роли", "Статус", "Точка", "График", "Дата 1-й смены"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((r) => `${r.displayName} ${r.login} ${r.phone}`.toLowerCase().includes(q.toLowerCase()))
              .map((r) => (
                <tr key={r.id} className={r.shiftOpen ? "is-on" : ""}>
                  <td>
                    {!dismissed && (
                      <button
                        type="button"
                        className="rounded bg-coral px-2 py-1 text-xs text-white"
                        onClick={async () => {
                          await api(`/api/v1/clubs/${clubId}/staff/${r.id}/dismiss`, { method: "POST", body: "{}" });
                          load();
                        }}
                      >
                        уволить
                      </button>
                    )}
                  </td>
                  <td>{r.n}</td>
                  <td>{r.displayName}</td>
                  <td>{r.shiftOpen ? new Date(r.shiftOpen).toLocaleTimeString("ru-BY", { hour: "2-digit", minute: "2-digit" }) : ""}</td>
                  <td>{r.login}</td>
                  <td>{ROLE_LABELS[r.role as RoleName] ?? r.role}</td>
                  <td>{r.status === "DISMISSED" ? "уволен" : "обычный"}</td>
                  <td>{r.workPoint}</td>
                  <td>{r.schedule}</td>
                  <td>{r.firstShiftAt ? new Date(r.firstShiftAt).toLocaleDateString("ru-BY") : ""}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="ops-card mt-6 max-w-xl">
        <h3 className="font-semibold">Добавить анкету</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input className={field} placeholder="ФИО" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          <input className={field} placeholder="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className={field} placeholder="Логин" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
          <input className={field} placeholder="Пароль" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input className={field} placeholder="Точка" value={form.workPoint} onChange={(e) => setForm({ ...form, workPoint: e.target.value })} />
          <select className={field} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {STAFF_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn-hud mt-3 min-h-10 px-4 text-sm"
          onClick={async () => {
            setMsg("");
            try {
              await api(`/api/v1/clubs/${clubId}/staff/full`, {
                method: "POST",
                body: JSON.stringify({ ...form, wageKopecks: Math.round(Number(form.wage) * 100) }),
              });
              setMsg("Сотрудник добавлен");
              load();
            } catch (e: any) {
              setMsg(e.message);
            }
          }}
        >
          Добавить анкету
        </button>
        {msg && <p className="mt-2 text-sm text-coral">{msg}</p>}
      </div>
    </div>
  );
}

export function GuestBalances({ clubId }: { clubId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    api<any[]>(`/api/v1/clubs/${clubId}/guest-table${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then(setRows)
      .catch(() => undefined);
  }, [clubId, q]);
  return (
    <div>
      <OpsTitle>Статистика и балансы гостей</OpsTitle>
      <FilterBar>
        <input className="ops-field max-w-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ФИО или телефон" />
        <button type="button" className="ops-pill" onClick={() => csvDownload("guests.csv", rows)}>
          Экспорт CSV
        </button>
      </FilterBar>
      <OpsTable
        columns={[
          { key: "displayName", label: "ФИО" },
          { key: "group", label: "Группа" },
          { key: "phone", label: "Телефон" },
          { key: "balance", label: "Баланс" },
          { key: "bonus", label: "Бонусный баланс" },
          { key: "gender", label: "Пол" },
          { key: "lastAuth", label: "Последняя авторизация" },
          { key: "createdAt", label: "Дата регистрации" },
        ]}
        rows={rows.map((r) => ({
          id: r.id,
          displayName: r.displayName,
          group: r.group,
          phone: phoneLabel(r.phone, r.walkIn),
          balance: formatByn(r.balanceKopecks),
          bonus: formatByn(r.bonusKopecks),
          gender: r.gender || "—",
          lastAuth: r.lastAuth ? new Date(r.lastAuth).toLocaleString("ru-BY") : "—",
          createdAt: new Date(r.createdAt).toLocaleString("ru-BY"),
        }))}
      />
    </div>
  );
}

function SimpleCrud({
  clubId,
  title,
  get,
  post,
  fields,
  mapRow,
  columns,
}: {
  clubId: string;
  title: string;
  get: string;
  post: string;
  fields: { key: string; label: string }[];
  mapRow: (r: any) => Record<string, unknown>;
  columns: { key: string; label: string }[];
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  async function load() {
    setRows(await api(`${get}`));
  }
  useEffect(() => {
    load().catch(() => undefined);
  }, [clubId]);
  return (
    <div>
      <OpsTitle>{title}</OpsTitle>
      <OpsTable columns={columns} rows={rows.map(mapRow)} />
      <div className="ops-card mt-4 flex flex-wrap gap-2">
        {fields.map((f) => (
          <input key={f.key} className="ops-field max-w-xs" placeholder={f.label} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
        ))}
        <button
          type="button"
          className="btn-hud min-h-10 px-4 text-sm"
          onClick={async () => {
            const body: Record<string, unknown> = { ...form };
            for (const k of ["percent", "amountKopecks", "minSpendKopecks"]) {
              if (body[k] != null && body[k] !== "") body[k] = Number(body[k]);
            }
            await api(post, { method: "POST", body: JSON.stringify(body) });
            setForm({});
            load();
          }}
        >
          Добавить
        </button>
      </div>
    </div>
  );
}

export function PcTypes({ clubId }: { clubId: string }) {
  return (
    <SimpleCrud
      clubId={clubId}
      title="Типы ПК в клубах"
      get={`/api/v1/clubs/${clubId}/pc-types`}
      post={`/api/v1/clubs/${clubId}/pc-types`}
      fields={[{ key: "name", label: "Название типа" }]}
      columns={[
        { key: "name", label: "Тип" },
        { key: "n", label: "ПК" },
      ]}
      mapRow={(r) => ({ id: r.id, name: r.name, n: r._count?.seats ?? 0 })}
    />
  );
}

export function PcBind({ clubId, club }: { clubId: string; club: any }) {
  const [types, setTypes] = useState<any[]>([]);
  const seats = club?.zones?.flatMap((z: any) => z.seats.map((s: any) => ({ ...s, zone: z.name }))) ?? [];
  useEffect(() => {
    api<any[]>(`/api/v1/clubs/${clubId}/pc-types`).then(setTypes).catch(() => undefined);
  }, [clubId]);
  return (
    <div>
      <OpsTitle>Привязка ПК по типам</OpsTitle>
      <div className="ops-card overflow-x-auto">
        <table className="ops-table">
          <thead>
            <tr>
              <th>ПК</th>
              <th>Тип</th>
            </tr>
          </thead>
          <tbody>
            {seats.map((s: any) => (
              <tr key={s.id}>
                <td>
                  {s.zone} · {s.label}
                </td>
                <td>
                  <select
                    className="ops-field max-w-xs"
                    defaultValue={s.pcTypeId ?? ""}
                    onChange={(e) =>
                      api(`/api/v1/clubs/${clubId}/pc-types/bind`, {
                        method: "POST",
                        body: JSON.stringify({ seatId: s.id, pcTypeId: e.target.value || undefined }),
                      })
                    }
                  >
                    <option value="">не задан</option>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BookingCalc({ clubId, club }: { clubId: string; club: any }) {
  const seats = club?.zones?.flatMap((z: any) => z.seats) ?? [];
  const [seatId, setSeatId] = useState(seats[0]?.id ?? "");
  const [tariffId, setTariffId] = useState(club?.tariffs?.[0]?.id ?? "");
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("20:00");
  const [quote, setQuote] = useState<any>(null);
  const date = new Date().toISOString().slice(0, 10);
  return (
    <div className="ops-card max-w-lg">
      <h2 className="ops-h">Калькулятор бронирования</h2>
      <div className="mt-4 grid gap-2">
        <select className={field} value={seatId} onChange={(e) => setSeatId(e.target.value)}>
          {seats.map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select className={field} value={tariffId} onChange={(e) => setTariffId(e.target.value)}>
          {club?.tariffs?.map((t: any) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input className={field} value={start} onChange={(e) => setStart(e.target.value)} />
          <input className={field} value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <button
          type="button"
          className="btn-hud min-h-10 text-sm"
          onClick={async () => {
            const q = await api(
              `/api/v1/clubs/${clubId}/booking-quote?seatId=${seatId}&tariffId=${tariffId}&startsAt=${date}T${start}:00&endsAt=${date}T${end}:00`,
            );
            setQuote(q);
          }}
        >
          Посчитать
        </button>
        {quote && <p className="text-lg font-bold">{quote.amountLabel}</p>}
      </div>
    </div>
  );
}

export function ConsoleScreen({
  tab,
  clubId,
  club,
  role,
  onSaved,
}: {
  tab: string;
  clubId: string;
  club: any;
  role: string;
  onSaved?: () => void;
}) {
  const modules = (club?.modules ?? {}) as Record<string, boolean>;
  const set = (title: string, hint: string, fields: { key: string; label: string; type?: string }[]) => (
    <SettingsBlock clubId={clubId} title={title} hint={hint} fields={fields} />
  );

  if (tab === "partners") return <PartnersTab />;
  if (tab === "help") return <HelpTab />;
  if (tab === "dash") return <ClubDash clubId={clubId} />;
  if (tab === "dashnet") return <NetworkDash />;
  if (tab === "analytics") return <DashTab clubId={clubId} isSuper={role === "SUPERADMIN"} />;
  if (tab === "hall") return <HallTab clubId={clubId} club={club} />;
  if (tab === "bookings") return <BookingsTab clubId={clubId} club={club} />;
  if (tab === "map") return <MapTab clubId={clubId} club={club} onSaved={onSaved} />;
  if (tab === "shift") return <ShiftTab clubId={clubId} />;
  if (tab === "topup") return <TopupTab clubId={clubId} />;
  if (tab === "cash" || tab === "products") return <CashTab clubId={clubId} />;
  if (tab === "accounts") return <AccountsLive clubId={clubId} />;
  if (tab === "news") return <NewsLive clubId={clubId} />;
  if (tab === "mail") return <MailLive clubId={clubId} />;
  if (tab === "devices") return <DevicesLive clubId={clubId} />;
  if (tab === "set_club") return <ClubSettingsTab clubId={clubId} club={club} onSaved={onSaved} />;
  if (tab === "set_tariffs") return <TariffsLive clubId={clubId} club={club} onSaved={onSaved} />;
  if (tab === "set_pctypes") return <PcTypes clubId={clubId} />;
  if (tab === "set_pcbind") return <PcBind clubId={clubId} club={club} />;
  if (tab === "staff_list") return <StaffList clubId={clubId} />;
  if (tab === "staff_rights") return <RightsMatrix clubId={clubId} />;
  if (tab === "staff_access") return <AccessLogic />;
  if (tab === "staff_payroll") return <Payroll clubId={clubId} />;
  if (tab === "staff_tickets") return <Tickets clubId={clubId} network={role === "SUPPORT" || role === "SUPERADMIN"} />;
  if (tab === "guest_balances") return <GuestBalances clubId={clubId} />;
  if (tab === "guest_search_pc") return <GuestsTab clubId={clubId} />;
  if (tab === "guest_groups")
    return (
      <SimpleCrud
        clubId={clubId}
        title="Группы гостей"
        get={`/api/v1/clubs/${clubId}/guest-groups`}
        post={`/api/v1/clubs/${clubId}/guest-groups`}
        fields={[{ key: "name", label: "Название" }]}
        columns={[{ key: "name", label: "Группа" }]}
        mapRow={(r) => ({ id: r.id, name: r.name })}
      />
    );
  if (tab === "guest_autobonus")
    return (
      <SimpleCrud
        clubId={clubId}
        title="Правила автобонусов"
        get={`/api/v1/clubs/${clubId}/autobonus`}
        post={`/api/v1/clubs/${clubId}/autobonus`}
        fields={[
          { key: "name", label: "Название" },
          { key: "percent", label: "%" },
        ]}
        columns={[
          { key: "name", label: "Правило" },
          { key: "percent", label: "%" },
        ]}
        mapRow={(r) => ({ id: r.id, name: r.name, percent: r.percent })}
      />
    );
  if (tab === "guest_blacklist")
    return (
      <SimpleCrud
        clubId={clubId}
        title="Черный список телефонов"
        get={`/api/v1/clubs/${clubId}/blacklist`}
        post={`/api/v1/clubs/${clubId}/blacklist`}
        fields={[
          { key: "phone", label: "+375" },
          { key: "reason", label: "Причина" },
        ]}
        columns={[
          { key: "phone", label: "Телефон" },
          { key: "reason", label: "Причина" },
        ]}
        mapRow={(r) => ({ id: r.id, phone: r.phone, reason: r.reason })}
      />
    );
  if (tab === "guest_certs" || tab === "set_certs")
    return (
      <SimpleCrud
        clubId={clubId}
        title="Подарочные сертификаты"
        get={`/api/v1/clubs/${clubId}/gift-certs`}
        post={`/api/v1/clubs/${clubId}/gift-certs`}
        fields={[{ key: "amountKopecks", label: "Сумма в копейках" }]}
        columns={[
          { key: "code", label: "Код" },
          { key: "amount", label: "Сумма" },
          { key: "status", label: "Статус" },
        ]}
        mapRow={(r) => ({ id: r.id, code: r.code, amount: formatByn(r.amountKopecks), status: r.status })}
      />
    );
  if (tab === "guest_promo" && modules.promo === false) {
    return <EmptyModule title="Работа с промокодами недоступна" />;
  }
  if (tab === "guest_promo" || tab === "set_promoset")
    return (
      <SimpleCrud
        clubId={clubId}
        title="Промокоды"
        get={`/api/v1/clubs/${clubId}/promos`}
        post={`/api/v1/clubs/${clubId}/promos`}
        fields={[
          { key: "code", label: "Код" },
          { key: "percent", label: "%" },
        ]}
        columns={[
          { key: "code", label: "Код" },
          { key: "percent", label: "%" },
        ]}
        mapRow={(r) => ({ id: r.id, code: r.code, percent: r.percent })}
      />
    );
  if (tab === "mod_calc") return <BookingCalc clubId={clubId} club={club} />;
  if (tab === "mod_logs" || tab === "tech_agent") return <AgentQueue clubId={clubId} />;
  if (tab === "tech_load") return <TechLoad clubId={clubId} />;
  if (tab === "mod_card_guest") return <GuestsTab clubId={clubId} />;
  if (tab === "mod_rent") return <HallTab clubId={clubId} club={club} />;

  const logs: Record<string, [string, string]> = {
    guest_log_walkin: ["walkin", "Лог одноразовых аккаунтов"],
    guest_log_profile: ["profile", "Лог изменений в анкетах гостей"],
    guest_log_manual: ["manual", "Лог ручных начислений/списаний"],
    guest_log_sales: ["sales", "Лог продаж гостям"],
    guest_log_bind: ["bind", "Лог привязки гостя к админу"],
    guest_log_promo: ["promo", "Лог активации промокодов"],
    guest_log_void: ["void", "Лог аннулированных чеков"],
    guest_log_ref: ["referral", "Лог начислений реферального бонуса"],
    guest_log_blacklist: ["blacklist", "Лог чёрного списка"],
    guest_log_import: ["import", "Лог импорта гостей"],
    staff_notif_log: ["staff_notify", "Лог работы с уведомлениями"],
  };
  if (logs[tab]) return <EventLog clubId={clubId} kind={logs[tab][0]} title={logs[tab][1]} />;

  const settings: Record<string, [string, string, { key: string; label: string; type?: string }[]]> = {
    set_software: ["Конфигурация ПО", "Параметры Windows-агента и облака", [{ key: "agentChannel", label: "Канал обновлений" }, { key: "offlineMinutes", label: "Минут до офлайна" }]],
    set_dynprice: ["Динамическое ценообразование", "Наценка к тарифу в часы пик", [{ key: "dynMarkupPct", label: "Наценка, %" }, { key: "dynHours", label: "Часы (18-23)" }]],
    set_payments: ["Платежные системы", "bePaid и ЕРИП, без СБП", [{ key: "bepaidShop", label: "bePaid shop id" }, { key: "eripService", label: "Код услуги ЕРИП" }]],
    set_income_mgr: ["Доходы и расходы управляющего", "", [{ key: "mgrIncome", label: "Статьи дохода" }, { key: "mgrExpense", label: "Статьи расхода" }]],
    set_income_cash: ["Доходы и расходы кассы", "", [{ key: "cashIncome", label: "Статьи кассы" }]],
    set_sensors: ["Датчики температуры", "Порог и лог, агент пришлёт значения", [{ key: "tempMax", label: "Макс. °C" }]],
    set_startup: ["Удаление элементов при старте", "Очередь агенту", [{ key: "startupClean", label: "Пути через ;" }]],
    set_freeze_ex_reg: ["Исключения заморозки реестра", "", [{ key: "freezeRegEx", label: "Ключи реестра" }]],
    set_freeze_ex: ["Исключения системы заморозки", "", [{ key: "freezeEx", label: "Пути" }]],
    set_freeze: ["Настройка системы заморозки", "Windows-агент", [{ key: "freezeOn", label: "Включить", type: "check" }]],
    set_paydesk: ["Оплата на стойке", "", [{ key: "paydeskCash", label: "Наличные", type: "check" }, { key: "paydeskCard", label: "Карта", type: "check" }]],
    set_erip: ["ЕРИП / bePaid", "Беларусь", [{ key: "eripOn", label: "ЕРИП", type: "check" }, { key: "bepaidOn", label: "bePaid", type: "check" }]],
    set_kiosk: ["Терминал самообслуживания", "", [{ key: "kioskPin", label: "PIN терминала" }]],
    set_hosts: ["Файл hosts", "Уйдёт в очередь агента", [{ key: "hostsExtra", label: "Строки hosts" }]],
    set_tablets: ["Планшеты", "", [{ key: "tabletCount", label: "Количество" }]],
    set_software_wait: ["", "", []],
    staff_notif: ["Уведомления сотрудникам", "", [{ key: "staffNotify", label: "Каналы" }]],
    guest_form: ["Конфигуратор анкеты", "Поля анкеты гостя", [{ key: "formFields", label: "Поля через запятую" }]],
    guest_notify: ["Уведомления гостям", "", [{ key: "guestNotify", label: "Шаблон" }]],
    guest_loyalty: ["Отчет лояльности", "Правила баллов", [{ key: "loyaltyPct", label: "% с чека" }]],
    guest_sounds: ["Звуковые оповещения", "", [{ key: "soundCall", label: "Вызов админа", type: "check" }]],
    guest_ref: ["Реферальный бонус", "Не MLM: бонус за приведённого гостя", [{ key: "refBonus", label: "Br за друга" }]],
    mod_energy_mon: ["Энергосбережение мониторов", "Игнорировать перевод", [{ key: "ignoreMonSleep", label: "Игнорировать", type: "check" }]],
    mod_energy_pc: ["Энергосбережение ПК", "Игнорировать перевод", [{ key: "ignorePcSleep", label: "Игнорировать", type: "check" }]],
    mod_card_admin: ["Генератор карт администратора", "", [{ key: "adminCardPrefix", label: "Префикс" }]],
    mod_phones: ["Телефоны и коды", "Коды доступа в клуб", [{ key: "doorCodes", label: "Коды" }]],
  };
  if (settings[tab]) return set(settings[tab][0], settings[tab][1], settings[tab][2]);

  return <EmptyModule title="Раздел" text="Экран не найден" />;
}

function AccessLogic() {
  return (
    <div className="ops-card max-w-2xl">
      <h2 className="ops-h">Подключения и роли</h2>
      <dl className="mt-5 space-y-4 text-sm text-[#333]">
        <div>
          <dt className="font-semibold">Гость</dt>
          <dd className="mt-1 text-[#555]">Регистрация, OTP, карта или walk-in на стойке. Первая бронь или чек привязывает человека к клубу. Кабинет: баланс, бронь, друзья.</dd>
        </div>
        <div>
          <dt className="font-semibold">Кассир / бармен / смена</dt>
          <dd className="mt-1 text-[#555]">Владелец или управляющий добавляет сотрудника в клуб. Кассир — касса и пополнение, бармен — бар, смена — зал, брони и гости.</dd>
        </div>
        <div>
          <dt className="font-semibold">Тех. администратор клуба</dt>
          <dd className="mt-1 text-[#555]">Карта, устройства, заморозка, hosts, очередь Windows-агента. Без кассы и без прав на сотрудников.</dd>
        </div>
        <div>
          <dt className="font-semibold">Управляющий и владелец</dt>
          <dd className="mt-1 text-[#555]">Управляющий ведёт смену и гостей, не трогает платежи и матрицу прав. Владелец — весь клуб, включая тарифы, bePaid/ЕРИП и найм.</dd>
        </div>
        <div>
          <dt className="font-semibold">Техподдержка и администратор сети</dt>
          <dd className="mt-1 text-[#555]">Поддержка заходит в любой клуб без членства, видит тикеты и технику. Администратор сети — все клубы, дашборд сети, CSV.</dd>
        </div>
        <div>
          <dt className="font-semibold">Новый клуб</dt>
          <dd className="mt-1 text-[#555]">Форма «Подключить клуб»: создаётся точка, автор становится владельцем и попадает в консоль.</dd>
        </div>
      </dl>
    </div>
  );
}

function RightsMatrix({ clubId }: { clubId: string }) {
  const leaves = CONSOLE_GROUPS.flatMap((g) =>
    g.href ? [{ id: g.href, label: g.label }] : (g.children ?? []).map((c) => ({ id: c.id, label: `${g.label} / ${c.label}` })),
  ).filter((r) => r.id !== "dashnet");
  const cols = ASSIGNABLE_CLUB_ROLES.filter((r) => r !== "OWNER");
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api<any>(`/api/v1/clubs/${clubId}/access`)
      .then((a) => {
        const next: Record<string, string[]> = {};
        for (const role of cols) next[role] = a.matrix?.[role]?.length ? a.matrix[role] : DEFAULT_TABS[role];
        setMatrix(next);
      })
      .catch(() => undefined);
  }, [clubId]);

  function toggle(role: string, tab: string) {
    setMatrix((m) => {
      const cur = new Set(m[role] ?? []);
      if (cur.has(tab)) cur.delete(tab);
      else cur.add(tab);
      return { ...m, [role]: [...cur] };
    });
  }

  return (
    <div>
      <OpsTitle>Права и доступы</OpsTitle>
      <p className="mb-4 text-sm text-[#5c5c5c]">Матрица роль × раздел. Владелец и сеть всегда видят весь клуб. Поддержка сети не редактируется здесь.</p>
      <div className="ops-card overflow-x-auto">
        <table className="ops-table">
          <thead>
            <tr>
              <th>Раздел</th>
              {cols.map((c) => (
                <th key={c}>{ROLE_LABELS[c]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leaves.map((row) => (
              <tr key={row.id}>
                <td>{row.label}</td>
                {cols.map((c) => (
                  <td key={c}>
                    <input type="checkbox" checked={(matrix[c] ?? []).includes(row.id)} onChange={() => toggle(c, row.id)} aria-label={`${ROLE_LABELS[c]} ${row.label}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="btn-hud mt-4 min-h-10 px-4 text-sm"
        onClick={async () => {
          setMsg("");
          try {
            await api(`/api/v1/clubs/${clubId}/rights`, { method: "PATCH", body: JSON.stringify({ matrix }) });
            setMsg("Сохранено");
          } catch (e: any) {
            setMsg(e.message);
          }
        }}
      >
        Сохранить матрицу
      </button>
      {msg && <p className="mt-2 text-sm text-coral">{msg}</p>}
    </div>
  );
}

function Payroll({ clubId }: { clubId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    api<any[]>(`/api/v1/clubs/${clubId}/payroll`).then(setRows).catch(() => undefined);
  }, [clubId]);
  return (
    <div>
      <OpsTitle>Расчет ЗП</OpsTitle>
      <OpsTable
        columns={[
          { key: "displayName", label: "ФИО" },
          { key: "hours", label: "Часы за 30 дней" },
          { key: "pay", label: "К выплате" },
        ]}
        rows={rows.map((r) => ({ id: r.id, displayName: r.displayName, hours: r.hours, pay: formatByn(r.payKopecks) }))}
      />
    </div>
  );
}

function Tickets({ clubId, network }: { clubId: string; network?: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  async function load() {
    if (network) {
      const all = await api<any[]>(`/api/v1/support/tickets`).catch(() => []);
      const local = await api<any[]>(`/api/v1/clubs/${clubId}/tickets`).catch(() => []);
      setRows(all.length ? all : local);
      return;
    }
    setRows(await api(`/api/v1/clubs/${clubId}/tickets`));
  }
  useEffect(() => {
    load().catch(() => undefined);
  }, [clubId]);
  return (
    <div>
      <OpsTitle>{network ? "Тикеты сети" : "Тикеты смены"}</OpsTitle>
      <div className="mb-3 flex gap-2">
        <input className="ops-field max-w-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Тема" />
        <button
          type="button"
          className="btn-hud min-h-10 px-4 text-sm"
          onClick={async () => {
            await api(`/api/v1/clubs/${clubId}/tickets`, { method: "POST", body: JSON.stringify({ title }) });
            setTitle("");
            load();
          }}
        >
          Создать
        </button>
      </div>
      <OpsTable
        columns={[
          { key: "club", label: "Клуб" },
          { key: "title", label: "Тема" },
          { key: "status", label: "Статус" },
          { key: "who", label: "Кто" },
        ]}
        rows={rows.map((r) => ({
          id: r.id,
          club: r.club?.name ?? "",
          title: r.title,
          status: r.status,
          who: r.createdBy?.displayName,
        }))}
      />
    </div>
  );
}

function AgentQueue({ clubId }: { clubId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [command, setCommand] = useState("SYNC_HOSTS");
  async function load() {
    setRows(await api(`/api/v1/clubs/${clubId}/agent-commands`));
  }
  useEffect(() => {
    load().catch(() => undefined);
  }, [clubId]);
  return (
    <div>
      <OpsTitle>Очередь Windows-агента</OpsTitle>
      <p className="mb-3 text-sm text-[#6b6f7a]">Команды копятся здесь, пока агент не заберёт их. Сохранение hosts/freeze/startup ставит задачи само.</p>
      <div className="mb-3 flex gap-2">
        <input className="ops-field max-w-xs" value={command} onChange={(e) => setCommand(e.target.value)} />
        <button
          type="button"
          className="btn-hud min-h-10 px-4 text-sm"
          onClick={async () => {
            await api(`/api/v1/clubs/${clubId}/agent-commands`, { method: "POST", body: JSON.stringify({ command }) });
            load();
          }}
        >
          В очередь
        </button>
      </div>
      <OpsTable
        columns={[
          { key: "createdAt", label: "Когда" },
          { key: "seat", label: "Место" },
          { key: "command", label: "Команда" },
          { key: "status", label: "Статус" },
          { key: "payload", label: "Payload" },
        ]}
        rows={rows.map((r) => ({
          id: r.id,
          createdAt: new Date(r.createdAt).toLocaleString("ru-BY"),
          seat: r.seat?.label ?? "зал",
          command: r.command,
          status: r.status,
          payload: r.result ? String(r.result).slice(0, 80) : JSON.stringify(r.payload ?? {}).slice(0, 80),
        }))}
      />
    </div>
  );
}

function TechLoad({ clubId }: { clubId: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    api(`/api/v1/clubs/${clubId}/analytics/occupancy?hours=24`).then(setData).catch(() => undefined);
  }, [clubId]);
  return (
    <div className="ops-card">
      <OpsTitle>Загрузка зала</OpsTitle>
      <p className="text-sm text-[#6b6f7a]">Мест: {data?.seats ?? "—"}</p>
      <ul className="mt-3 grid grid-cols-6 gap-1 text-xs">
        {(data?.buckets ?? []).map((b: any) => (
          <li key={b.hour} className="rounded bg-white p-2" style={{ outline: `2px solid rgba(32,21,255,${(b.occupancyPct ?? 0) / 100})` }}>
            {new Date(b.hour).getHours()}:00 · {b.occupancyPct}%
          </li>
        ))}
      </ul>
    </div>
  );
}

function AccountsLive({ clubId }: { clubId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ guestName: "", platform: "steam", login: "" });
  async function load() {
    setRows(await api(`/api/v1/clubs/${clubId}/game-accounts`));
  }
  useEffect(() => {
    load().catch(() => undefined);
  }, [clubId]);
  return (
    <div>
      <OpsTitle>Игровые аккаунты</OpsTitle>
      <OpsTable
        columns={[
          { key: "guestName", label: "Гость" },
          { key: "platform", label: "Платформа" },
          { key: "login", label: "Логин" },
        ]}
        rows={rows}
      />
      <div className="ops-card mt-4 flex flex-wrap gap-2">
        <input className="ops-field max-w-xs" placeholder="Имя" value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} />
        <input className="ops-field max-w-xs" placeholder="Логин" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
        <button
          type="button"
          className="btn-hud min-h-10 px-4 text-sm"
          onClick={async () => {
            await api(`/api/v1/clubs/${clubId}/game-accounts`, { method: "POST", body: JSON.stringify(form) });
            load();
          }}
        >
          Добавить
        </button>
      </div>
    </div>
  );
}

function NewsLive({ clubId }: { clubId: string }) {
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <div className="ops-card max-w-lg">
      <OpsTitle>Новости клуба</OpsTitle>
      <input className="ops-field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок" />
      <button
        type="button"
        className="btn-hud mt-3 min-h-10 px-4 text-sm"
        onClick={async () => {
          await api(`/api/v1/clubs/${clubId}/news`, { method: "POST", body: JSON.stringify({ title }) });
          setMsg("Опубликовано");
        }}
      >
        Опубликовать
      </button>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </div>
  );
}

function MailLive({ clubId }: { clubId: string }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <div className="ops-card max-w-lg">
      <OpsTitle>Рассылки</OpsTitle>
      <input className="ops-field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Тема" />
      <textarea className="ops-field mt-2 min-h-28 py-2" value={body} onChange={(e) => setBody(e.target.value)} />
      <button
        type="button"
        className="btn-hud mt-3 min-h-10 px-4 text-sm"
        onClick={async () => {
          const r = await api<{ sent: number }>(`/api/v1/clubs/${clubId}/mailings`, { method: "POST", body: JSON.stringify({ title, body }) });
          setMsg(`Отправлено: ${r.sent}`);
        }}
      >
        Отправить гостям
      </button>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </div>
  );
}

function DevicesLive({ clubId }: { clubId: string }) {
  const [seats, setSeats] = useState<any[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  async function load() {
    setSeats(await api<any[]>(`/api/v1/clubs/${clubId}/seat-map`));
  }
  useEffect(() => {
    load().catch(() => undefined);
    const t = setInterval(() => load().catch(() => undefined), 10000);
    return () => clearInterval(t);
  }, [clubId]);
  return (
    <div>
      <OpsTitle>Панель устройств</OpsTitle>
      <div className="grid gap-2 sm:grid-cols-3">
        {seats.map((s) => (
          <div key={s.id} className="ops-card">
            <p className="font-semibold">{s.label}</p>
            <p className="text-xs text-[#6b6f7a]">{s.status}{s.hostname ? ` · ${s.hostname}` : ""}</p>
            <p className="mt-1 text-xs text-[#6b6f7a]">
              {s.lastHeartbeatAt
                ? `агент: ${new Date(s.lastHeartbeatAt).toLocaleTimeString("ru-BY")}${s.agentVersion ? ` · v${s.agentVersion}` : ""}`
                : s.agentPaired
                  ? "агент привязан, нет heartbeat"
                  : "агент не привязан"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="text-sm text-coral"
                onClick={() => api(`/api/v1/clubs/${clubId}/seats/${s.id}/command`, { method: "POST", body: JSON.stringify({ command: "REBOOT" }) })}
              >
                Ребут
              </button>
              <button
                type="button"
                className="text-sm text-[#2015FF]"
                onClick={async () => {
                  const r = await api<{ code: string }>(`/api/v1/clubs/${clubId}/seats/${s.id}/pair`, { method: "POST", body: "{}" });
                  setCodes((m) => ({ ...m, [s.id]: r.code }));
                }}
              >
                Код агента
              </button>
            </div>
            {codes[s.id] && <p className="mt-2 font-mono text-lg tracking-widest">{codes[s.id]}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function TariffsLive({ clubId, club, onSaved }: { clubId: string; club: any; onSaved?: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("12");
  return (
    <div className="ops-card max-w-lg">
      <OpsTitle>Тарифы</OpsTitle>
      <ul className="text-sm">
        {club?.tariffs?.map((t: any) => (
          <li key={t.id} className="py-1">
            {t.name} · {formatByn(t.pricePerHourKopecks)}/ч
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input className="ops-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" />
        <input className="ops-field w-24" value={price} onChange={(e) => setPrice(e.target.value)} />
        <button
          type="button"
          className="btn-hud min-h-10 px-3 text-sm"
          onClick={async () => {
            await api(`/api/v1/clubs/${clubId}/tariffs`, {
              method: "POST",
              body: JSON.stringify({ name, pricePerHourKopecks: Math.round(Number(price) * 100) }),
            });
            onSaved?.();
          }}
        >
          Добавить
        </button>
      </div>
    </div>
  );
}
