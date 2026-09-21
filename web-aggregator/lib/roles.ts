import {
  CLUB_STAFF_ROLES,
  ROLE_LABELS,
  canAccessTab,
  homeTab,
  isClubStaffRole,
  isConsoleRole,
  tabsForRole,
  type RoleName,
} from "./acl";

export type ClubRoleName =
  | "GUEST"
  | "CASHIER"
  | "BARTENDER"
  | "CLUB_ADMIN"
  | "TECH_ADMIN"
  | "MANAGER"
  | "OWNER"
  | "SUPPORT"
  | "SUPERADMIN";

export type MeUser = {
  id: string;
  displayName: string;
  phone?: string;
  globalRole?: string;
  clubRoles?: { clubId: string; role: string }[];
  wallet?: { balanceKopecks: number; bonusKopecks?: number };
};

export { ROLE_LABELS, tabsForRole, homeTab, CLUB_STAFF_ROLES };

export function isStaff(me?: MeUser | null) {
  if (!me) return false;
  if (me.globalRole === "SUPERADMIN" || me.globalRole === "SUPPORT") return true;
  return (me.clubRoles ?? []).some((r) => isClubStaffRole(r.role));
}

export function roleForClub(me: MeUser | null | undefined, clubId?: string): ClubRoleName {
  if (!me) return "GUEST";
  if (me.globalRole === "SUPERADMIN") return "SUPERADMIN";
  if (me.globalRole === "SUPPORT") return "SUPPORT";
  const rows = me.clubRoles ?? [];
  const row = clubId ? rows.find((r) => r.clubId === clubId) : rows.find((r) => isClubStaffRole(r.role)) ?? rows[0];
  if (row && isConsoleRole(row.role)) return row.role as ClubRoleName;
  return "GUEST";
}

export function roleLabel(role: ClubRoleName) {
  return ROLE_LABELS[role as RoleName] ?? "гость";
}

export type ConsoleTab = string;

export function tabAllowed(tab: ConsoleTab, role: ClubRoleName, allowed?: string[]) {
  if (allowed) return allowed.includes(tab);
  return canAccessTab(role as RoleName, tab);
}

export function homeAfterLogin(me: MeUser) {
  if (!me?.id) return "/cabinet";
  const role = roleForClub(me);
  if (!isStaff(me)) return "/cabinet";
  return `/club-admin?tab=${homeTab(role as RoleName)}`;
}

export function consoleTabs(role: ClubRoleName): { id: ConsoleTab; label: string }[] {
  return [
    { id: "dash", label: "Дашборд" },
    { id: "hall", label: "Зал" },
    { id: "bookings", label: "Брони" },
    { id: "guest_balances", label: "Гости" },
    { id: "topup", label: "Касса" },
  ].filter((t) => tabAllowed(t.id, role));
}
