import Link from "next/link";
import { API, type ClubSummary } from "@/lib/api";
import { formatByn } from "@/lib/money";

export const metadata = { title: "RUDEMIR для бизнеса" };

export default async function BusinessPage() {
  const res = await fetch(`${API}/api/v1/clubs`, { cache: "no-store" }).catch(() => null);
  const clubs: ClubSummary[] = res?.ok ? await res.json() : [];

  return (
    <div>
      <section className="bleed blue-block cut-b -mt-24 pb-20 pt-28 md:pb-28 md:pt-40">
        <div className="mx-auto max-w-wrap px-4 md:px-6">
          <h1 className="display text-[56px] text-white md:text-[112px] xl:text-[132px]">
            Клубу.
            <br />
            Сеть. Облако.
          </h1>
          <p className="mt-6 max-w-lg text-lg font-medium text-white/80">
            Агрегатор, ПО для зала и приложение для гостей — в одном контуре. Оплата в Br через bePaid и ЕРИП.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/connect" className="btn-hud">
              Подключить клуб
            </Link>
            <Link href="/software" className="btn-ghost">
              ПО
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <h2 className="display text-[56px] text-ink md:text-[96px]">Клубы сети</h2>
        <p className="mt-3 max-w-xl text-dim">Карточка на сайте бесплатна: цены, железо и свободные места ведёт сам клуб.</p>
        <ul className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {clubs.map((c) => (
            <li key={c.id} className="glass rounded-xl p-6">
              <p className="display text-[36px] text-ink">{c.name}</p>
              <p className="mt-1 text-sm text-dim">{c.address}</p>
              <p className="mono mt-5 text-xs uppercase text-dim">
                {c.totalSeats} пк
                {c.minPricePerHourKopecks != null && (
                  <span className="ml-3 text-coral">от {formatByn(c.minPricePerHourKopecks)}/ч</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="bleed paper cut-tb py-24 md:py-36">
        <div className="mx-auto max-w-wrap px-4 md:px-6">
          <h2 className="display text-[56px] text-ink md:text-[96px]">Сообщество</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["Конференция", "Ежегодная встреча владельцев клубов Беларуси."],
              ["Закрытый чат", "Только для владельцев и управляющих."],
              ["Биржа", "Железо, кресла, периферия от брендов и других клубов."],
              ["Киберспорт", "Турниры сети с общей сеткой и призовыми."],
            ].map(([t, d]) => (
              <div key={t}>
                <h3 className="display text-[36px] text-ink">{t}</h3>
                <p className="mt-2 text-[#5c5c5c]">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 py-16 md:grid-cols-2">
        <div className="blue-block rounded-xl p-8 md:p-10">
          <h2 className="display text-[48px] text-white md:text-[64px]">Software</h2>
          <p className="mt-3 text-lg text-white/80">ПК, сессии, тарифы, брони, касса, смены. Облако, без своего сервера.</p>
          <Link href="/software" className="btn-hud mt-8">
            ПО
          </Link>
        </div>
        <div className="glass rounded-xl p-8 md:p-10">
          <h2 className="display text-[48px] text-ink md:text-[64px]">App</h2>
          <p className="mt-3 text-lg text-dim">Гости регистрируются, пополняют баланс и бронируют место в любом клубе сети.</p>
          <Link href="/app" className="btn-hud mt-8">
            App
          </Link>
        </div>
      </section>
    </div>
  );
}
