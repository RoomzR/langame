import Link from "next/link";
import type { ClubSummary } from "@/lib/api";
import { MARKET } from "@/lib/money";

function ruCount(n: number, one: string, few: string, many: string) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return `${n} ${one}`;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

export function HeroBoard({ clubs, free }: { clubs: ClubSummary[]; free: number }) {
  const rows = MARKET.cities
    .map((city) => {
      const here = clubs.filter((c) => c.city === city);
      return {
        city,
        free: here.reduce((s, c) => s + c.freeSeats, 0),
        live: here.length > 0,
      };
    });
  const live = rows.filter((r) => r.live);
  const soon = rows.filter((r) => !r.live).map((r) => r.city);

  return (
    <aside className="hero-board">
      <p className="hero-board-kicker">
        {ruCount(free, "место свободно", "места свободно", "мест свободно")}
        <span aria-hidden> · </span>
        {ruCount(clubs.length, "клуб", "клуба", "клубов")}
      </p>
      <ul className="hero-board-cities">
        {live.map((row) => (
          <li key={row.city}>
                <Link href={`/?city=${encodeURIComponent(row.city)}#clubs`} className="hero-board-row">
              <span className="display">{row.city}</span>
              <span className="display hero-board-n">{row.free}</span>
            </Link>
          </li>
        ))}
      </ul>
      {soon.length > 0 && <p className="hero-board-soon">{soon.join(", ")} — скоро</p>}
    </aside>
  );
}
