import Link from "next/link";
import { formatByn } from "@/lib/money";
import type { ClubSummary } from "@/lib/api";

const AMENITY: Record<string, string> = {
  wifi: "Wi-Fi",
  bar: "Бар",
  vr: "VR",
  tournament: "Турниры",
  parking: "Парковка",
  console: "Консоли",
  lockers: "Шкафчики",
};

function isHallPhoto(url: string | null) {
  if (!url) return false;
  return !/unsplash\.com|pexels\.com|shutterstock/i.test(url);
}

export function ClubCard({ club }: { club: ClubSummary; flip?: boolean }) {
  const photo = isHallPhoto(club.coverUrl);
  const fill = club.totalSeats ? Math.round(((club.totalSeats - club.freeSeats) / club.totalSeats) * 100) : 0;

  return (
    <Link
      href={`/clubs/${club.slug}`}
      className="group relative flex min-h-[420px] flex-col justify-between overflow-hidden rounded-xl bg-elevated transition-[transform,box-shadow] duration-300 ease-hud hover:-translate-y-1.5 hover:shadow-lift"
    >
      <div className="absolute inset-0">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={club.coverUrl!}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 ease-hud group-hover:scale-105"
          />
        ) : (
          <div className="hall-glow h-full w-full" aria-hidden />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-base via-base/60 to-transparent" />
      </div>

      <div className="relative flex items-start justify-between p-5">
        <span className="glass mono rounded-md px-3 py-1.5 text-xs text-ink">{club.city}</span>
        <span className="mono rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-ink">
          {club.freeSeats} свободно
        </span>
      </div>

      <div className="relative p-5">
        <h2 className="display text-[44px] text-ink">{club.name}</h2>
        <p className="mt-1 text-sm text-dim">{club.address}</p>
        <div className="mt-5 flex items-end justify-between gap-4 border-t border-line pt-4">
          <div>
            <p className="text-xs text-dim">от</p>
            <p className="display text-[32px] text-coral">
              {club.minPricePerHourKopecks != null ? formatByn(club.minPricePerHourKopecks) : "—"}
              <span className="ml-1 font-sans text-sm font-semibold normal-case tracking-normal text-dim">/ч</span>
            </p>
          </div>
          <div className="text-right text-xs text-dim">
            <p>{club.ratingCount ? `${club.ratingAvg.toFixed(1)} · ${club.ratingCount} отзывов` : "Отзывов нет"}</p>
            <p className="mt-1">{(club.amenities ?? []).slice(0, 3).map((a) => AMENITY[a] ?? a).join(" · ")}</p>
          </div>
        </div>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <div className="h-full bg-coral transition-[width] duration-500 ease-hud" style={{ width: `${fill}%` }} />
        </div>
        <p className="mono mt-2 text-[11px] uppercase text-dim">загрузка зала {fill}% · {club.totalSeats} мест</p>
      </div>
    </Link>
  );
}
