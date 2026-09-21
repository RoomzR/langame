import Link from "next/link";

export const metadata = { title: "RUDEMIR App — бронирование компьютерных клубов" };

export default function AppPage() {
  return (
    <div>
      <section className="bleed blue-block cut-b -mt-24 pb-24 pt-28 md:pb-32 md:pt-40">
        <div className="mx-auto grid max-w-wrap items-end gap-12 px-4 md:px-6 xl:grid-cols-[1.2fr_1fr]">
          <div>
            <h1 className="display text-[56px] text-white md:text-[112px] xl:text-[132px]">
              Найди клуб.
              <br />
              Бронь за минуту.
            </h1>
            <p className="mt-6 max-w-md text-lg font-medium text-white/80">
              Баланс, карта зала и друзья в одном приложении. Пополнение через bePaid и ЕРИП работает во всех клубах сети.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <span className="btn-ghost pointer-events-none opacity-70">App Store · скоро</span>
              <span className="btn-ghost pointer-events-none opacity-70">Google Play · скоро</span>
              <Link href="/#clubs" className="btn-hud">
                В зал
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-[300px] rotate-[-6deg] rounded-[40px] border border-white/20 bg-black/20 p-3 shadow-lift md:w-[340px]">
            <div className="rounded-[30px] bg-base p-6">
              <p className="display text-2xl text-ink">Rudemir</p>
              <p className="mono mt-8 text-xs uppercase text-dim">Минск</p>
              <p className="display text-4xl text-ink">RUDEMIR Arena</p>
              <div className="mt-5 grid grid-cols-4 gap-1.5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className={`h-10 rounded-md ${[2, 5, 9].includes(i) ? "bg-elevated shadow-[inset_0_0_0_1.5px_#FF6A3D]" : "bg-accent"}`} />
                ))}
              </div>
              <div className="glass mt-5 rounded-lg p-4">
                <p className="mono text-xs text-dim">Сегодня 19:00 — 21:00</p>
                <p className="display mt-1 text-2xl text-coral">PC-03 · 24.00 Br</p>
              </div>
              <div className="btn-hud mt-4 min-h-12 w-full text-base">Бронь</div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <h2 className="display text-[56px] text-ink md:text-[96px]">Что умеет</h2>
        <ul className="mt-10 grid gap-10 md:grid-cols-2">
          {[
            ["Найти клуб", "Город, улица, цены, отзывы. Свободные места видны сразу."],
            ["Пополнить", "bePaid или ЕРИП. Деньги работают во всех клубах сети."],
            ["Взять место", "Дата, время, конкретный ПК на карте зала. Оплата с баланса."],
            ["Друзья", "Добавляйте игроков, смотрите, кто в зале, записывайтесь на турниры."],
          ].map(([t, d]) => (
            <li key={t} className="border-t border-line pt-5">
              <h3 className="display text-[36px] text-ink md:text-[48px]">{t}</h3>
              <p className="mt-2 max-w-md text-dim">{d}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
