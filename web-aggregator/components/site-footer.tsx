"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const COLS: [string, [string, string][]][] = [
  [
    "Гостям",
    [
      ["/#clubs", "Клубы"],
      ["/tournaments", "Турниры"],
      ["/news", "Новости"],
      ["/app", "Приложение"],
    ],
  ],
  [
    "Клубам",
    [
      ["/business", "Для бизнеса"],
      ["/software", "ПО для клуба"],
      ["/club-admin", "Консоль клуба"],
    ],
  ],
  [
    "Аккаунт",
    [
      ["/cabinet", "Кабинет"],
      ["/login", "Войти"],
      ["/register", "Регистрация"],
    ],
  ],
];

export function SiteFooter() {
  const path = usePathname();
  if (path.startsWith("/club-admin") || path.startsWith("/login") || path.startsWith("/register")) return null;
  return (
    <footer className="paper cut-t mt-8">
      <div className="mx-auto max-w-wrap px-4 pb-32 pt-24 md:px-6 md:pb-16 md:pt-28">
        <p className="display text-[clamp(72px,16vw,240px)] text-ink">Rudemir</p>
        <div className="mt-10 grid gap-10 border-t border-black/10 pt-10 text-[15px] md:grid-cols-[2fr_1fr_1fr_1fr]">
          <p className="max-w-xs text-[#5c5c5c]">
            Компьютерные клубы Беларуси. Бронь места за минуту, оплата в Br через bePaid и ЕРИП.
          </p>
          {COLS.map(([title, links]) => (
            <div key={title} className="grid content-start gap-3">
              <p className="font-bold text-ink">{title}</p>
              {links.map(([href, label]) => (
                <Link key={href} href={href} className="text-[#5c5c5c] hover:text-ink">
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <p className="mono mt-12 text-xs text-[#8a8a8a]">© 2026 RUDEMIR · Минск · UTC+3</p>
      </div>
    </footer>
  );
}
