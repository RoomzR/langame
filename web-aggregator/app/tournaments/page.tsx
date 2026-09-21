import { API } from "@/lib/api";
import Link from "next/link";

export default async function TournamentsPage() {
  const clubsRes = await fetch(`${API}/api/v1/clubs`, { cache: "no-store" }).catch(() => null);
  const clubs = clubsRes?.ok ? await clubsRes.json() : [];
  const rows: any[] = [];
  for (const c of clubs) {
    const t = await fetch(`${API}/api/v1/clubs/${c.id}/tournaments`, { cache: "no-store" }).catch(() => null);
    const list = t?.ok ? await t.json() : [];
    for (const item of list) rows.push({ ...item, club: c });
  }
  return (
    <div>
      <h1 className="display text-[56px] text-ink md:text-[96px]">Турниры</h1>
      <p className="mt-3 max-w-xl text-dim">Сетки single-elimination. Запись через клуб, старт даёт смена.</p>
      <ul className="mt-10 divide-y divide-line">
        {rows.map((t) => (
          <li key={t.id} className="flex flex-wrap items-end justify-between gap-4 py-6">
            <div>
              <p className="display text-[36px] text-ink md:text-[48px]">{t.name}</p>
              <p className="mono mt-1 text-xs uppercase text-dim">
                {t.club.name} · {t.game || "микс"} · {t.status} · {new Date(t.startsAt).toLocaleString("ru-BY")}
              </p>
            </div>
            <Link className="btn-hud min-h-12 text-base" href={`/clubs/${t.club.slug}`}>
              Клуб
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="py-8 text-dim">Ближайших турниров нет</li>}
      </ul>
    </div>
  );
}
