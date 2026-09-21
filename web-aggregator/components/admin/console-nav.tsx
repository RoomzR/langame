"use client";

import { useMemo, useState } from "react";
import { tabAllowed, type ClubRoleName } from "@/lib/roles";

type Item = { id: string; label: string };
type Group = { id: string; label: string; href?: string; children?: Item[] };

export const CONSOLE_GROUPS: Group[] = [
  { id: "partners", label: "Предложения партнёров", href: "partners" },
  { id: "dash", label: "Дашборд", href: "dash" },
  { id: "dashnet", label: "Дашборд сети", href: "dashnet" },
  { id: "help", label: "Помощь и контакты", href: "help" },
  {
    id: "settings",
    label: "Общие настройки",
    children: [
      { id: "set_software", label: "Конфигурация ПО" },
      { id: "set_club", label: "Параметры клубов" },
      { id: "set_pctypes", label: "Типы ПК в клубах" },
      { id: "set_pcbind", label: "Привязка ПК по типам" },
      { id: "set_tariffs", label: "Тарифы" },
      { id: "set_dynprice", label: "Динамическое ценообразование" },
      { id: "set_payments", label: "Конфигурация платежных систем" },
      { id: "set_income_mgr", label: "Настройка доходов и расходов управляющего" },
      { id: "set_income_cash", label: "Настройка доходов и расходов кассы" },
      { id: "set_certs", label: "Настройка подарочных сертификатов" },
      { id: "set_sensors", label: "Настройка датчиков температуры" },
      { id: "set_startup", label: "Удаление элементов при старте" },
      { id: "set_freeze_ex_reg", label: "Исключения системы заморозки реестра" },
      { id: "set_freeze_ex", label: "Исключения системы заморозки" },
      { id: "set_freeze", label: "Настройка системы заморозки" },
      { id: "set_paydesk", label: "Оплата" },
      { id: "set_erip", label: "Подключение ЕРИП / bePaid" },
      { id: "set_kiosk", label: "Терминал самообслуживания" },
      { id: "set_hosts", label: "Управление файлом hosts" },
      { id: "set_tablets", label: "Планшеты" },
      { id: "set_promoset", label: "Промокоды" },
    ],
  },
  {
    id: "staffg",
    label: "Работа с сотрудниками",
    children: [
      { id: "staff_list", label: "Список всех сотрудников" },
      { id: "staff_rights", label: "Права и доступы" },
      { id: "staff_access", label: "Настройка доступов и разрешений" },
      { id: "staff_notif", label: "Настройка информационных и контрольных уведомлений" },
      { id: "staff_notif_log", label: "Лог и контроль работы с уведомлениями" },
      { id: "staff_tickets", label: "Настройка системы тикетов" },
      { id: "staff_payroll", label: "Расчет ЗП" },
    ],
  },
  {
    id: "guestg",
    label: "Работа с гостями",
    children: [
      { id: "guest_groups", label: "Настройка групп гостей" },
      { id: "guest_autobonus", label: "Правила автобонусов" },
      { id: "guest_balances", label: "Статистика и балансы гостей" },
      { id: "guest_search_pc", label: "Поиск гостей по ПК" },
      { id: "guest_log_walkin", label: "Лог одноразовых аккаунтов" },
      { id: "guest_log_profile", label: "Лог изменений в анкетах гостей" },
      { id: "guest_log_manual", label: "Лог ручных начислений/списаний" },
      { id: "guest_log_sales", label: "Лог продаж гостям" },
      { id: "guest_log_bind", label: "Лог привязки гостя к админу" },
      { id: "guest_log_promo", label: "Лог активации глобальных промокодов" },
      { id: "guest_log_void", label: "Лог аннулированных чеков" },
      { id: "guest_form", label: "Конфигуратор анкеты гостя" },
      { id: "guest_blacklist", label: "Черный список телефонов" },
      { id: "guest_certs", label: "Подарочные сертификаты" },
      { id: "guest_notify", label: "Уведомления гостям" },
      { id: "guest_loyalty", label: "Отчет лояльности" },
      { id: "guest_sounds", label: "Звуковые оповещения" },
      { id: "guest_promo", label: "Активации промокодов" },
      { id: "guest_ref", label: "Реферальный бонус" },
      { id: "guest_log_ref", label: "Лог начислений реферального бонуса" },
      { id: "guest_log_blacklist", label: "Лог чёрного списка телефонов" },
      { id: "guest_log_import", label: "Лог импорта гостей" },
    ],
  },
  { id: "accg", label: "Игровые аккаунты", children: [{ id: "accounts", label: "Steam / Discord" }] },
  {
    id: "proc",
    label: "Контроль процессов",
    children: [
      { id: "hall", label: "Зал" },
      { id: "bookings", label: "Бронирование" },
      { id: "map", label: "Карта зала" },
      { id: "shift", label: "Смена" },
    ],
  },
  { id: "design", label: "Оформление и реклама", children: [{ id: "news", label: "Новости клуба" }] },
  {
    id: "work",
    label: "Рабочее пространство управляющего",
    children: [
      { id: "topup", label: "Пополнение баланса" },
      { id: "cash", label: "Касса бара" },
    ],
  },
  { id: "sales", label: "Товар и продажи", children: [{ id: "products", label: "Бар и мерч" }] },
  { id: "mail", label: "Рассылки", href: "mail" },
  {
    id: "modg",
    label: "Дополнительные модули",
    children: [
      { id: "mod_energy_mon", label: "Игнорировать перевод в энергосбережение мониторов" },
      { id: "mod_energy_pc", label: "Игнорировать перевод в энергосбережение ПК" },
      { id: "mod_card_admin", label: "Генератор карт для администратора" },
      { id: "mod_card_guest", label: "Генератор карт" },
      { id: "mod_phones", label: "Телефоны и коды" },
      { id: "mod_rent", label: "Аренды ПК" },
      { id: "mod_calc", label: "Калькулятор бронирования" },
      { id: "mod_logs", label: "Логи" },
    ],
  },
  { id: "analytics", label: "Аналитика", href: "analytics" },
  {
    id: "techg",
    label: "Техническая статистика домена",
    children: [
      { id: "tech_load", label: "Загрузка зала" },
      { id: "tech_agent", label: "Очередь Windows-агента" },
    ],
  },
  { id: "devices", label: "Панель управления устройствами", href: "devices" },
  { id: "guestlist", label: "Гости", children: [{ id: "guest_balances", label: "Список гостей" }] },
];

export function ConsoleNav({
  tab,
  role,
  allowed,
  onSelect,
}: {
  tab: string;
  role: ClubRoleName;
  allowed?: string[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    settings: true,
    staffg: true,
    guestg: true,
    proc: true,
    work: true,
    modg: true,
  });

  const visible = useMemo(
    () =>
      CONSOLE_GROUPS.filter((g) => {
        if (g.href) return tabAllowed(g.href, role, allowed);
        return (g.children ?? []).some((c) => tabAllowed(c.id, role, allowed));
      }),
    [role, allowed],
  );

  return (
    <nav className="console-nav" aria-label="Консоль клуба">
      {visible.map((g) => {
        const kids = (g.children ?? []).filter((c) => tabAllowed(c.id, role, allowed));
        const active = g.href === tab || kids.some((c) => c.id === tab);
        if (g.href) {
          return (
            <button
              key={g.id}
              type="button"
              className={`console-item ${active ? "is-on" : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={() => onSelect(g.href!)}
            >
              <span>{g.label}</span>
            </button>
          );
        }
        const expanded = open[g.id] ?? active;
        return (
          <div key={g.id}>
            <button
              type="button"
              className={`console-item ${active ? "is-on" : ""}`}
              aria-expanded={expanded}
              onClick={() => setOpen((s) => ({ ...s, [g.id]: !expanded }))}
            >
              <span>{g.label}</span>
              <span className={`console-chevron ${expanded ? "is-open" : ""}`}>▾</span>
            </button>
            {expanded && (
              <div className="console-sub">
                {kids.map((c) => (
                  <button
                    key={`${g.id}-${c.id}`}
                    type="button"
                    className={`console-subitem ${tab === c.id ? "is-on" : ""}`}
                    aria-current={tab === c.id ? "page" : undefined}
                    onClick={() => onSelect(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
