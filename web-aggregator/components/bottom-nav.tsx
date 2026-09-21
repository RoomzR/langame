"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AUTH_EVENT, api, token } from "@/lib/api";
import { isStaff, type MeUser } from "@/lib/roles";

function IconGrid() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="1" y="1" width="7" height="7" stroke="currentColor" strokeWidth="2" />
      <rect x="12" y="1" width="7" height="7" stroke="currentColor" strokeWidth="2" />
      <rect x="1" y="12" width="7" height="7" stroke="currentColor" strokeWidth="2" />
      <rect x="12" y="12" width="7" height="7" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconBracket() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="3" y="4" width="5" height="15" stroke="currentColor" strokeWidth="2" />
      <rect x="12" y="1" width="5" height="12" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconApp() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M2 2h16v16H2V2z" stroke="currentColor" strokeWidth="2" />
      <path d="M18 2v6h-6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconCabinet() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2" y="7" width="16" height="11" stroke="currentColor" strokeWidth="2" />
      <path d="M2 4h16" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

const GUEST = [
  { href: "/#clubs", match: (p: string) => p === "/" || p.startsWith("/clubs"), label: "Клубы", Icon: IconGrid },
  { href: "/tournaments", match: (p: string) => p.startsWith("/tournaments"), label: "Турниры", Icon: IconBracket },
  { href: "/app", match: (p: string) => p.startsWith("/app"), label: "App", Icon: IconApp },
  { href: "/cabinet", match: (p: string) => p.startsWith("/cabinet") || p.startsWith("/login"), label: "Кабинет", Icon: IconCabinet },
];

const STAFF = [
  { href: "/club-admin?tab=hall", match: (p: string) => p.startsWith("/club-admin"), label: "Зал", Icon: IconGrid },
  { href: "/club-admin?tab=bookings", match: (p: string) => p.includes("bookings"), label: "Брони", Icon: IconBracket },
  { href: "/club-admin?tab=cash", match: (p: string) => p.includes("cash"), label: "Касса", Icon: IconApp },
  { href: "/cabinet", match: (p: string) => p.startsWith("/cabinet"), label: "Кабинет", Icon: IconCabinet },
];

export function BottomNav() {
  const path = usePathname();
  const [staff, setStaff] = useState(false);

  useEffect(() => {
    function refresh() {
      if (!token()) {
        setStaff(false);
        return;
      }
      api<MeUser>("/api/v1/auth/me")
        .then((me) => setStaff(isStaff(me)))
        .catch(() => setStaff(false));
    }
    refresh();
    window.addEventListener(AUTH_EVENT, refresh);
    return () => window.removeEventListener(AUTH_EVENT, refresh);
  }, [path]);

  if (path.startsWith("/club-admin") || path.startsWith("/login") || path.startsWith("/register")) return null;

  const items = staff ? STAFF : GUEST;

  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 h-16 md:hidden" aria-label="Разделы">
      <ul className="glass grid h-full grid-cols-4 rounded-2xl p-1.5">
        {items.map(({ href, match, label, Icon }) => {
          const on = match(path);
          return (
            <li key={label} className="h-full">
              <Link
                href={href}
                className={`flex h-full flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold ${on ? "bg-accent text-ink" : "text-dim"}`}
              >
                <Icon />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
