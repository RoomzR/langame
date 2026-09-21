import Link from "next/link";

export const metadata = { title: "RUDEMIR Software — ПО для компьютерного клуба" };

const FEATURES: [string, string][] = [
  ["ПК", "Блокировка, перезагрузка, техрежим, массовые действия по залу."],
  ["Сессии", "Поминутное списание или пакеты. Пауза, продление, перенос."],
  ["Бронь", "Гости бронируют с сайта и приложения. Смена подтверждает приход."],
  ["Касса", "Бар и мерч с места гостя или со стойки, списание с баланса."],
  ["Гости", "Профили, карты с PIN, бонусы, история сессий и платежей."],
  ["Смены", "Открытие, выручка, загрузка по часам, возвраты."],
  ["Оплата", "bePaid и ЕРИП: гость пополняет сам — из app, с сайта или с места."],
  ["Турниры", "Сетка single-elimination, запись, результаты матчей."],
];

export default function SoftwarePage() {
  return (
    <div>
      <section className="bleed blue-block cut-b -mt-24 pb-20 pt-28 md:pb-28 md:pt-40">
        <div className="mx-auto max-w-wrap px-4 md:px-6">
          <h1 className="display text-[56px] text-white md:text-[112px] xl:text-[132px]">
            ПО для зала.
            <br />
            Без сервера.
          </h1>
          <p className="mt-6 max-w-lg text-lg font-medium text-white/80">
            Лаунчер вместо рабочего стола. Один аккаунт гостя работает во всех клубах сети.
          </p>
          <Link href="/register" className="btn-hud mt-8">
            Подключить клуб
          </Link>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <h2 className="display text-[56px] text-ink md:text-[96px]">Возможности</h2>
        <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(([t, d]) => (
            <li key={t} className="border-t border-line pt-4">
              <h3 className="display text-[32px] text-ink">{t}</h3>
              <p className="mt-2 text-sm text-dim">{d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="bleed paper cut-tb py-24 md:py-32">
        <div className="mx-auto grid max-w-wrap gap-10 px-4 md:grid-cols-3 md:px-6">
          {[
            ["Guest Client", "Киоск на игровом ПК: вход, таймер, баланс, лаунчер, бар."],
            ["Admin Console", "Карта зала, сессии, брони, гости, касса, привязка ПК."],
            ["Агент", "Служба Windows на каждом месте: hosts, политика заморозки, reboot, heartbeat."],
          ].map(([t, d]) => (
            <div key={t}>
              <h3 className="display text-[40px] text-ink">{t}</h3>
              <p className="mt-2 text-[#5c5c5c]">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
