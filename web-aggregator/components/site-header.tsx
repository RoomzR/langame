"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AUTH_EVENT, api, clearTokens, token } from "@/lib/api";
import { formatByn } from "@/lib/money";
import { isStaff, roleForClub, roleLabel, type MeUser } from "@/lib/roles";

export function SiteHeader() {
  const path = usePathname();
  const [me, setMe] = useState<MeUser | null>(null);
  const [known, setKnown] = useState(false);
  const [solid, setSolid] = useState(false);
  const hidden = path.startsWith("/club-admin") || path.startsWith("/login") || path.startsWith("/register");

  useEffect(() => {
    let cancelled = false;

    function apply(user: MeUser | null, ready: boolean) {
      if (cancelled) return;
      setMe(user);
      setKnown(ready);
    }

    function refresh() {
      if (!token()) {
        apply(null, true);
        return;
      }
      api<MeUser>("/api/v1/auth/me")
        .then((user) => apply(user, true))
        .catch(() => apply(null, true));
    }

    refresh();
    window.addEventListener(AUTH_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_EVENT, refresh);
    };
  }, [path]);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function logout() {
    clearTokens();
    setMe(null);
    setKnown(true);
    window.location.href = "/";
  }

  const staff = isStaff(me);
  const role = roleForClub(me);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-[background,border-color] duration-200 ease-hud ${
        hidden ? "hidden" : solid ? "glass border-b" : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-wrap items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" className="display text-[28px] text-ink">
          Rudemir
        </Link>
        <div className="hidden items-center gap-6 text-[15px] font-semibold text-ink/80 md:flex">
          {staff ? (
            <Link href="/club-admin" className="hover:text-ink">
              Консоль
            </Link>
          ) : (
            <>
              <Link href="/#clubs" className="hover:text-ink">
                Клубы
              </Link>
              <Link href="/tournaments" className="hover:text-ink">
                Турниры
              </Link>
              <Link href="/app" className="hover:text-ink">
                App
              </Link>
              <Link href="/business" className="hover:text-ink">
                Бизнесу
              </Link>
            </>
          )}
        </div>
        <div className="hidden min-h-10 min-w-[200px] items-center justify-end gap-2 text-sm md:flex">
          {me ? (
            <>
              <Link href={staff ? "/club-admin" : "/cabinet"} className="btn-login">
                {me.displayName}
                {!staff && <span className="mono ml-3 text-coral">{formatByn(me.wallet?.balanceKopecks ?? 0)}</span>}
                {staff && <span className="mono ml-3 text-white/50">{roleLabel(role)}</span>}
              </Link>
              {staff && (
                <Link href="/cabinet" className="btn-login text-ink/70">
                  Кабинет
                </Link>
              )}
              <button type="button" onClick={logout} className="btn-login text-ink/70">
                Выйти
              </button>
            </>
          ) : known ? (
            <>
              <Link href="/login" className="btn-login">
                Войти
              </Link>
              <Link href="/register" className="btn-hud on-blue min-h-10 px-5 text-base">
                Регистрация
              </Link>
            </>
          ) : null}
        </div>
        <Link href={me ? (staff ? "/club-admin" : "/cabinet") : "/login"} className="btn-login md:hidden">
          {me ? me.displayName : known ? "Войти" : ""}
        </Link>
      </nav>
    </header>
  );
}
