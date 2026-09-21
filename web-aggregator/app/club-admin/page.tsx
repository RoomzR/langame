"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { ConsoleNav } from "@/components/admin/console-nav";
import { ConsoleScreen } from "@/components/admin/ops-screens";
import { ErrorBanner, Skeleton } from "@/components/hud-states";
import { homeTab, roleForClub, roleLabel, tabAllowed, type ConsoleTab, type MeUser } from "@/lib/roles";

export default function ClubAdminPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <ClubAdminInner />
    </Suspense>
  );
}

function ClubAdminInner() {
  const params = useSearchParams();
  const [me, setMe] = useState<MeUser | null>(null);
  const [clubs, setClubs] = useState<any[]>([]);
  const [clubId, setClubId] = useState("");
  const [club, setClub] = useState<any>(null);
  const [tab, setTab] = useState<ConsoleTab>(params.get("tab") || "hall");
  const [error, setError] = useState("");
  const [rev, setRev] = useState(0);
  const [menu, setMenu] = useState(false);
  const [access, setAccess] = useState<{ tabs: string[]; canEditRights?: boolean } | null>(null);

  useEffect(() => {
    const q = params.get("tab");
    if (q) setTab(q);
  }, [params]);

  useEffect(() => {
    api<MeUser>("/api/v1/auth/me")
      .then(async (user) => {
        setMe(user);
        const roles = (user.clubRoles ?? []).filter((r) => r.role !== "GUEST");
        if (!roles.length && user.globalRole !== "SUPERADMIN" && user.globalRole !== "SUPPORT") {
          setError("Нет роли в клубе");
          return;
        }
        const all = await api<any[]>("/api/v1/clubs");
        const network = user.globalRole === "SUPERADMIN" || user.globalRole === "SUPPORT";
        const mine = network ? all : all.filter((c) => roles.some((r) => r.clubId === c.id));
        setClubs(mine);
        setClubId(mine[0]?.id ?? "");
        if (!params.get("tab")) setTab(homeTab(roleForClub(user, mine[0]?.id)));
      })
      .catch((e) => setError(e.message === "UNAUTHORIZED" ? "UNAUTHORIZED" : "Связь потеряна. Повторить"));
  }, []);

  useEffect(() => {
    if (!clubId) return;
    api<any>(`/api/v1/clubs/${clubId}`).then(setClub).catch(() => undefined);
    api<{ tabs: string[] }>(`/api/v1/clubs/${clubId}/access`)
      .then(setAccess)
      .catch(() => setAccess(null));
  }, [clubId, rev]);

  const role = roleForClub(me, clubId);

  if (error) {
    return error === "UNAUTHORIZED" || error === "Нет роли в клубе" ? (
      <div className="auth-stage">
        <div className="auth-copy">
          <h1 className="display text-[72px] text-white md:text-[120px]">Консоль</h1>
          <p className="mt-6 max-w-[22rem] text-lg text-white/75">{error === "UNAUTHORIZED" ? "Войти, чтобы открыть смену." : error}</p>
          <Link href="/login" className="btn-hud mt-8">
            Войти
          </Link>
        </div>
      </div>
    ) : (
      <ErrorBanner text={error} />
    );
  }
  if (!me || !clubId) return <Skeleton className="h-64" />;

  return (
    <div className="console-app">
      <aside className={`console-side ${menu ? "block" : "hidden md:block"}`}>
        <div className="console-side-brand">
          <span className="console-side-mark" />
          <div>
            <Link href="/" className="display text-[28px] leading-none text-white">
              Rudemir
            </Link>
            <p className="mono mt-1 text-[10px] uppercase text-white/40">{club?.name}</p>
          </div>
        </div>
        <p className="px-2 text-xs text-white/45">
          {me.displayName}
          <span className="mt-0.5 block text-white/30">{roleLabel(role)}</span>
        </p>
        {clubs.length > 1 && (
          <select value={clubId} onChange={(e) => setClubId(e.target.value)} className="field-hud mt-3">
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <div className="mt-4">
          <ConsoleNav
            tab={tab}
            role={role}
            allowed={access?.tabs}
            onSelect={(id) => {
              setTab(id);
              setMenu(false);
              window.history.replaceState(null, "", `/club-admin?tab=${id}`);
            }}
          />
        </div>
      </aside>
      <div className="console-main">
        <button type="button" className="mb-4 min-h-11 rounded-[4px] bg-white px-4 text-sm font-semibold shadow-sm md:hidden" onClick={() => setMenu(!menu)}>
          Меню
        </button>
        {tabAllowed(tab, role, access?.tabs) ? (
          <ConsoleScreen tab={tab} clubId={clubId} club={club} role={role} onSaved={() => setRev((n) => n + 1)} />
        ) : (
          <p>Нет доступа</p>
        )}
      </div>
    </div>
  );
}
