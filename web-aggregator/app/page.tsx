import Link from "next/link";
import { Suspense } from "react";
import { API, type ClubSummary } from "@/lib/api";
import { ClubCard } from "@/components/club-card";
import { HeroBoard } from "@/components/hero-board";
import { CityPicker } from "@/components/city-picker";
import { Marquee } from "@/components/marquee";
import { EmptyState, ErrorBanner } from "@/components/hud-states";
import { MARKET } from "@/lib/money";

async function loadClubs(city?: string, q?: string): Promise<{ clubs: ClubSummary[]; error: boolean }> {
  try {
    const p = new URLSearchParams();
    if (city) p.set("city", city);
    if (q) p.set("q", q);
    const res = await fetch(`${API}/api/v1/clubs${p.toString() ? `?${p}` : ""}`, { cache: "no-store" });
    return { clubs: res.ok ? await res.json() : [], error: !res.ok };
  } catch {
    return { clubs: [], error: true };
  }
}

async function loadNews() {
  try {
    const res = await fetch(`${API}/api/v1/news`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as any[]).slice(0, 3) : [];
  } catch {
    return [];
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; q?: string }>;
}) {
  const { city, q } = await searchParams;
  const [{ clubs, error }, { clubs: network }, news] = await Promise.all([
    loadClubs(city, q),
    loadClubs(),
    loadNews(),
  ]);
  const freeTotal = network.reduce((s, c) => s + c.freeSeats, 0);
  const ticker = [
    ...MARKET.cities.map((c) => c.toUpperCase()),
    `${freeTotal} мест свободно`,
    `${network.length} клубов`,
    "Оплата в Br",
    "Бронь за минуту",
  ];

  return (
    <div>
      {/* HERO */}
      <section className="bleed blue-block cut-b block-in relative -mt-24 overflow-hidden pb-20 pt-28 md:pb-28 md:pt-40">
        <div className="relative mx-auto max-w-wrap px-4 md:px-6">
          <div className="hero-stage">
            <div>
              <h1 className="display headline-in text-[56px] text-white md:text-[104px] xl:text-[128px]">
                Все клубы Беларуси.
                <br />
                Бронь за минуту.
              </h1>
              <p className="headline-in mt-8 max-w-md text-lg font-medium text-white/80" style={{ animationDelay: "160ms" }}>
                Свободные места в реальном времени, цены в белорусских рублях, место держится 15 минут.
              </p>
              <div className="headline-in mt-8 flex flex-wrap gap-3" style={{ animationDelay: "240ms" }}>
                <Link href="#clubs" className="btn-hud">
                  Клубы
                </Link>
                <Link href="/register" className="btn-ghost">
                  Регистрация
                </Link>
              </div>
            </div>
            <HeroBoard clubs={network} free={freeTotal} />
          </div>
        </div>
      </section>

      <Marquee items={ticker} />

      {/* CLUBS */}
      <section id="clubs" className="scroll-mt-24 py-16 md:py-24">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <h2 className="display text-[56px] text-ink md:text-[96px]">{city ? city : "Клубы"}</h2>
          <Suspense fallback={null}>
            <CityPicker compact />
          </Suspense>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {clubs.map((c) => (
            <ClubCard key={c.id} club={c} />
          ))}
          {error && clubs.length === 0 && <ErrorBanner />}
          {!error && clubs.length === 0 && <EmptyState text="В этом городе пока тихо" href="/" />}
        </div>
      </section>

      {/* MANIFEST */}
      <section className="bleed paper cut-tb py-28 md:py-40">
        <div className="mx-auto max-w-wrap px-4 md:px-6">
          <ol className="display text-[52px] text-ink md:text-[128px] xl:text-[160px]">
            {["Выбери клуб.", "Возьми место.", "Приходи и играй."].map((line, i) => (
              <li key={line} className="flex items-baseline gap-6">
                <span className="mono text-sm text-[#8a8a8a] md:text-lg">0{i + 1}</span>
                {line}
              </li>
            ))}
          </ol>
          <div className="mt-12 grid gap-8 text-[17px] text-[#5c5c5c] md:grid-cols-3">
            <p>Цены, железо, фото и отзывы. Фильтр по городу и улице.</p>
            <p>Карта зала, дата и время. Свободные ПК подсвечены синим.</p>
            <p>Сессия стартует сама, списание идёт с баланса. Продлить можно с места.</p>
          </div>
        </div>
      </section>

      {/* APP */}
      <section className="grid gap-10 py-20 md:py-28 xl:grid-cols-[1fr_1fr] xl:items-center">
        <div>
          <h2 className="display text-[56px] text-ink md:text-[96px]">App</h2>
          <p className="mt-4 max-w-md text-lg text-dim">
            Баланс, бронь и друзья в одном приложении. Пополнение через bePaid и ЕРИП работает во всех клубах сети.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <span className="btn-ghost pointer-events-none opacity-60">App Store · скоро</span>
            <span className="btn-ghost pointer-events-none opacity-60">Google Play · скоро</span>
            <Link href="/app" className="btn-hud">
              Подробнее
            </Link>
          </div>
        </div>
        <div className="relative mx-auto w-[300px] rotate-[-6deg] rounded-[40px] border border-line bg-elevated p-3 shadow-lift md:w-[340px]">
          <div className="hall-glow rounded-[30px] p-6">
            <p className="display text-2xl text-ink">Rudemir</p>
            <p className="mono mt-8 text-xs uppercase text-dim">Минск</p>
            <p className="display text-4xl text-ink">RUDEMIR Arena</p>
            <div className="mt-5 grid grid-cols-4 gap-1.5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-10 rounded-md ${[2, 5, 9].includes(i) ? "bg-elevated shadow-[inset_0_0_0_1.5px_#FF6A3D]" : "bg-accent"}`}
                />
              ))}
            </div>
            <div className="glass mt-5 rounded-lg p-4">
              <p className="mono text-xs text-dim">Сегодня 19:00 — 21:00</p>
              <p className="display mt-1 text-2xl text-coral">PC-03 · 24.00 Br</p>
            </div>
            <div className="btn-hud mt-4 min-h-12 w-full text-base">Бронь</div>
          </div>
        </div>
      </section>

      {/* BUSINESS + NEWS */}
      <section className="grid gap-5 py-10 md:py-16 xl:grid-cols-[1fr_1fr]">
        <div className="blue-block flex flex-col justify-between rounded-xl p-8 md:p-10">
          <div>
            <h2 className="display text-[56px] text-white md:text-[80px]">Клубу</h2>
            <p className="mt-3 max-w-sm text-lg text-white/80">
              ПК, сессии, касса и брони в одном облаке. Гости регистрируются сами и платят через bePaid и ЕРИП.
            </p>
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/business" className="btn-hud">
              Подключить клуб
            </Link>
            <Link href="/software" className="btn-ghost">
              ПО
            </Link>
          </div>
        </div>
        <div className="glass rounded-xl p-8 md:p-10">
          <h2 className="display text-[56px] text-ink md:text-[80px]">Новости</h2>
          <ul className="mt-4 divide-y divide-line">
            {news.map((n: any) => (
              <li key={n.id} className="py-4">
                <Link href={`/news/${n.slug}`} className="text-lg font-bold text-ink hover:text-coral">
                  {n.title}
                </Link>
                <p className="mt-1 text-sm text-dim">{n.excerpt}</p>
              </li>
            ))}
            {news.length === 0 && <li className="py-4 text-dim">Пока тихо</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}
