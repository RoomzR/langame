export type RoleName =
  | 'GUEST'
  | 'CASHIER'
  | 'BARTENDER'
  | 'CLUB_ADMIN'
  | 'TECH_ADMIN'
  | 'MANAGER'
  | 'OWNER'
  | 'SUPPORT'
  | 'SUPERADMIN';

export const CLUB_STAFF_ROLES: RoleName[] = [
  'CASHIER',
  'BARTENDER',
  'CLUB_ADMIN',
  'TECH_ADMIN',
  'MANAGER',
  'OWNER',
];

export const ASSIGNABLE_CLUB_ROLES: RoleName[] = [...CLUB_STAFF_ROLES];

export const ROLE_LABELS: Record<RoleName, string> = {
  GUEST: 'гость',
  CASHIER: 'кассир',
  BARTENDER: 'бармен',
  CLUB_ADMIN: 'администратор смены',
  TECH_ADMIN: 'технический администратор',
  MANAGER: 'управляющий',
  OWNER: 'владелец клуба',
  SUPPORT: 'техподдержка сети',
  SUPERADMIN: 'администратор сети',
};

const GUEST_CRM = [
  'guest_groups',
  'guest_autobonus',
  'guest_balances',
  'guest_search_pc',
  'guest_log_walkin',
  'guest_log_profile',
  'guest_log_manual',
  'guest_log_sales',
  'guest_log_bind',
  'guest_log_promo',
  'guest_log_void',
  'guest_form',
  'guest_blacklist',
  'guest_certs',
  'guest_notify',
  'guest_loyalty',
  'guest_sounds',
  'guest_promo',
  'guest_ref',
  'guest_log_ref',
  'guest_log_blacklist',
  'guest_log_import',
];

const SETTINGS_MONEY = ['set_payments', 'set_erip', 'set_paydesk', 'set_income_mgr', 'set_income_cash'];
const SETTINGS_TECH = [
  'set_software',
  'set_pctypes',
  'set_pcbind',
  'set_startup',
  'set_freeze_ex_reg',
  'set_freeze_ex',
  'set_freeze',
  'set_hosts',
  'set_tablets',
  'set_sensors',
];
const SETTINGS_CLUB = [
  'set_club',
  'set_tariffs',
  'set_dynprice',
  'set_certs',
  'set_kiosk',
  'set_promoset',
];
const SETTINGS_ALL = [...SETTINGS_CLUB, ...SETTINGS_MONEY, ...SETTINGS_TECH];
const STAFF_TABS = [
  'staff_list',
  'staff_rights',
  'staff_access',
  'staff_notif',
  'staff_notif_log',
  'staff_tickets',
  'staff_payroll',
];
const OPS = ['hall', 'bookings', 'map', 'shift'];
const MONEY = ['topup', 'cash', 'products'];
const TECH = ['tech_load', 'tech_agent', 'devices'];
const MODS = [
  'mod_energy_mon',
  'mod_energy_pc',
  'mod_card_admin',
  'mod_card_guest',
  'mod_phones',
  'mod_rent',
  'mod_calc',
  'mod_logs',
];

export const ALL_TABS = [
  'partners',
  'dash',
  'dashnet',
  'help',
  ...SETTINGS_ALL,
  ...STAFF_TABS,
  ...GUEST_CRM,
  'accounts',
  ...OPS,
  'news',
  ...MONEY,
  'mail',
  ...MODS,
  'analytics',
  ...TECH,
];

const uniq = (tabs: string[]) => [...new Set(tabs)];

export const DEFAULT_TABS: Record<RoleName, string[]> = {
  GUEST: [],
  CASHIER: uniq([
    'help',
    'partners',
    'topup',
    'cash',
    'guest_balances',
    'guest_search_pc',
    'guest_log_manual',
    'guest_log_sales',
    'guest_log_void',
    'shift',
  ]),
  BARTENDER: uniq(['help', 'products', 'cash']),
  CLUB_ADMIN: uniq([
    'help',
    'partners',
    ...OPS,
    ...GUEST_CRM,
    'accounts',
    ...MONEY,
    'mail',
    'news',
    'mod_calc',
    'mod_card_guest',
    'mod_phones',
    'tech_load',
    'devices',
  ]),
  TECH_ADMIN: uniq([
    'help',
    'map',
    'devices',
    ...TECH,
    ...SETTINGS_TECH,
    'mod_energy_mon',
    'mod_energy_pc',
    'mod_logs',
    'shift',
  ]),
  MANAGER: uniq([
    'help',
    'partners',
    'dash',
    ...OPS,
    ...GUEST_CRM,
    'accounts',
    ...MONEY,
    'mail',
    'news',
    ...MODS,
    'analytics',
    'tech_load',
    'devices',
    ...SETTINGS_CLUB,
    ...SETTINGS_TECH,
    'staff_list',
    'staff_notif',
    'staff_notif_log',
    'staff_tickets',
    'staff_payroll',
  ]),
  OWNER: uniq(ALL_TABS.filter((t) => t !== 'dashnet')),
  SUPPORT: uniq([
    'help',
    'partners',
    'dash',
    'hall',
    'map',
    'bookings',
    ...TECH,
    'staff_tickets',
    'guest_search_pc',
    'guest_balances',
  ]),
  SUPERADMIN: [...ALL_TABS],
};

export function isClubStaffRole(role?: string | null): role is RoleName {
  return !!role && (CLUB_STAFF_ROLES as string[]).includes(role);
}

export function isConsoleRole(role?: string | null): role is RoleName {
  return isClubStaffRole(role) || role === 'SUPPORT' || role === 'SUPERADMIN';
}

export function tabsForRole(role: RoleName, matrix?: Record<string, string[]> | null): string[] {
  if (role === 'SUPERADMIN') return [...ALL_TABS];
  if (role === 'SUPPORT') return DEFAULT_TABS.SUPPORT;
  if (role === 'OWNER') return DEFAULT_TABS.OWNER;
  const custom = matrix?.[role];
  if (Array.isArray(custom) && custom.length) return uniq(custom.filter((t) => ALL_TABS.includes(t)));
  return DEFAULT_TABS[role] ?? [];
}

export function canAccessTab(role: RoleName, tab: string, matrix?: Record<string, string[]> | null) {
  return tabsForRole(role, matrix).includes(tab);
}

export function canHireRole(actor: RoleName, target: RoleName) {
  if (actor === 'SUPERADMIN' || actor === 'OWNER') return ASSIGNABLE_CLUB_ROLES.includes(target);
  if (actor === 'MANAGER') {
    return target === 'CASHIER' || target === 'BARTENDER' || target === 'CLUB_ADMIN' || target === 'TECH_ADMIN';
  }
  return false;
}

export function homeTab(role: RoleName) {
  if (role === 'SUPERADMIN') return 'dash';
  if (role === 'SUPPORT') return 'staff_tickets';
  if (role === 'CASHIER') return 'topup';
  if (role === 'BARTENDER') return 'products';
  if (role === 'TECH_ADMIN') return 'tech_agent';
  if (role === 'OWNER' || role === 'MANAGER') return 'dash';
  return 'hall';
}

export function sectionsFromPath(method: string, path: string): string[] {
  const p = path.split('?')[0];
  const m = method.toUpperCase();
  if (/\/analytics\/network/.test(p)) return ['dashnet'];
  if (/\/analytics/.test(p)) return ['analytics', 'dash'];
  if (/\/agent-commands/.test(p)) return ['tech_agent'];
  if (/\/seats\/[^/]+\/pair/.test(p)) return ['devices', 'tech_agent', 'map', 'hall'];
  if (/\/seats\/[^/]+\/command/.test(p)) return ['devices', 'tech_agent', 'hall', 'map'];
  if (/\/tickets/.test(p)) return ['staff_tickets'];
  if (/\/payroll/.test(p)) return ['staff_payroll'];
  if (/\/staff/.test(p)) return ['staff_list'];
  if (/\/guest-table|\/guest-events/.test(p)) return ['guest_balances'];
  if (/\/guest-groups/.test(p)) return ['guest_groups'];
  if (/\/autobonus/.test(p)) return ['guest_autobonus'];
  if (/\/blacklist/.test(p)) return ['guest_blacklist'];
  if (/\/gift-certs/.test(p)) return ['guest_certs'];
  if (/\/promos/.test(p)) return ['set_promoset', 'guest_promo'];
  if (/\/pc-types/.test(p)) return ['set_pctypes'];
  if (/\/booking-quote/.test(p)) return ['mod_calc', 'bookings'];
  if (/\/walk-in|\/guests/.test(p)) return ['guest_balances', 'bookings'];
  if (/\/game-accounts/.test(p)) return ['accounts'];
  if (/\/mailings/.test(p)) return ['mail'];
  if (/\/modules/.test(p)) return ['mod_logs', 'set_club'];
  if (/\/guest-cards/.test(p)) return ['mod_card_guest', 'guest_balances'];
  if (/\/cash-ops/.test(p)) return ['cash', 'topup'];
  if (/\/topup|\/payments|\/bonus/.test(p)) return ['topup'];
  if (/\/products|\/orders/.test(p)) return ['products'];
  if (/\/bookings/.test(p)) return ['bookings', 'hall'];
  if (/\/sessions/.test(p)) return ['hall', 'tech_agent'];
  if (/\/lockers/.test(p)) return ['hall', 'map'];
  if (/\/tournaments/.test(p)) return ['news', 'hall'];
  if (/\/tariffs/.test(p)) return ['set_tariffs'];
  if (/\/hardware|\/zones|\/seats/.test(p)) return ['map', 'set_pcbind', 'hall'];
  if (/\/rights/.test(p)) return ['staff_rights'];
  if (/\/access$/.test(p)) return [];
  if (/\/settings/.test(p)) {
    if (m === 'GET') return [];
    return [...SETTINGS_ALL, 'staff_rights', 'staff_access'];
  }
  if (/PATCH/.test(m) && /\/clubs\/[^/]+$/.test(p)) return ['set_club'];
  return [];
}
