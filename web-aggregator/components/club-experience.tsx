"use client";

import { useCallback, useMemo, useState } from "react";
import { FlatHall, IsoHall } from "@/components/iso-hall";
import { BookingDesk, type AvailabilitySeat } from "@/components/booking-desk";
import { ReviewForm } from "@/components/review-form";
import { Ticker } from "@/components/ticker";
import { formatByn } from "@/lib/money";
import { api } from "@/lib/api";

const AMENITY: Record<string, string> = {
  wifi: "Wi-Fi",
  bar: "Бар и снеки",
  vr: "VR-зона",
  tournament: "Турниры",
  parking: "Парковка",
  console: "Консоли",
  lockers: "Шкафчики",
};

function isHallPhoto(url: string) {
  return !/unsplash\.com|pexels\.com|shutterstock/i.test(url);
}

function JoinTournament({ id, open }: { id: string; open: boolean }) {
  const [msg, setMsg] = useState("");
  if (!open) return null;
  return (
    <button
      type="button"
      className="link-coral"
      onClick={() =>
        api(`/api/v1/tournaments/${id}/join`, { method: "POST", body: "{}" })
          .then(() => setMsg("Вы в сетке"))
          .catch((e) => setMsg(e.message === "UNAUTHORIZED" ? "Войдите" : e.message))
      }
    >
      {msg || "Записаться"}
    </button>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="display text-[44px] text-ink md:text-[56px]">{children}</h2>;
}

export function ClubExperience({ club, tournaments = [] }: { club: any; tournaments?: any[] }) {
  const seats = useMemo(
    () => club.zones?.flatMap((z: any) => z.seats.map((s: any) => ({ ...s, zoneName: z.name }))) ?? [],
    [club.zones],
  );
  const [seatId, setSeatId] = useState<string | undefined>(seats.find((s: any) => s.status === "FREE")?.id ?? seats[0]?.id);
  const [avail, setAvail] = useState<Record<string, boolean>>();
  const [photo, setPhoto] = useState(0);
  const [sheet, setSheet] = useState(false);
  const onAvailability = useCallback((list: AvailabilitySeat[]) => {
    setAvail(Object.fromEntries(list.map((s) => [s.id, s.available])));
  }, []);

  const photos: any[] = (club.media ?? []).filter((p: any) => p.url && isHallPhoto(p.url));
  const amenities: string[] = Array.isArray(club.amenities) ? club.amenities : [];
  const hardware: any[] = club.hardware ?? [];
  const freeNow = seats.filter((s: any) => s.status === "FREE").length;
  const minPrice = club.tariffs?.[0]?.pricePerHourKopecks;

  function pickSeat(id: string) {
    setSeatId(id);
    if (window.innerWidth < 1280) setSheet(true);
  }

  return (
    <div>
      {/* MEDIA HEADER */}
      <section className="bleed cut-b relative -mt-24 min-h-[62vh] overflow-hidden">
        {photos.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photos[photo].url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="hall-glow absolute inset-0" aria-hidden />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-base via-base/40 to-base/20" />
        <div className="relative mx-auto flex min-h-[62vh] max-w-wrap flex-col justify-end px-4 pb-20 pt-32 md:px-6 md:pb-28">
          <p className="mono text-xs uppercase tracking-wide text-ink/70">
            {club.city} · {club.address}
          </p>
          <h1 className="display mt-2 text-[64px] text-ink md:text-[120px] xl:text-[144px]">{club.name}</h1>
          <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <p className="display text-[56px] text-ink md:text-[72px]">
                <Ticker value={freeNow} />
                <span className="text-ink/40">/{seats.length}</span>
              </p>
              <p className="mono text-xs uppercase text-dim">свободно сейчас</p>
            </div>
            <div>
              <p className="display text-[56px] text-coral md:text-[72px]">{minPrice != null ? formatByn(minPrice) : "—"}</p>
              <p className="mono text-xs uppercase text-dim">за час, от</p>
            </div>
            <div>
              <p className="display text-[56px] text-ink md:text-[72px]">{club.ratingCount ? club.ratingAvg.toFixed(1) : "—"}</p>
              <p className="mono text-xs uppercase text-dim">{club.ratingCount ? `${club.ratingCount} отзывов` : "нет отзывов"}</p>
            </div>
          </div>
          {photos.length > 1 && (
            <div className="mt-6 flex gap-2">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPhoto(i)}
                  aria-label={`Фото ${i + 1}`}
                  className={`h-2 w-8 rounded-full ${i === photo ? "bg-ink" : "bg-ink/30"}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <p className="mt-6 max-w-2xl text-lg text-dim">{club.description}</p>

      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:gap-8">
        <div className="min-w-0">
          <section id="hall" className="scroll-mt-24">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <H2>Зал</H2>
              <div className="flex flex-wrap gap-4 text-xs text-dim">
                {club.zones?.map((z: any) => (
                  <span key={z.id} className="mono uppercase">
                    {z.name}: {z.seats.length}
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-1 text-sm text-dim">Нажмите на место — оно подставится в бронь. Подсветка учитывает дату и время.</p>
            <FlatHall seats={seats} selectedId={seatId} onSelect={pickSeat} availability={avail} className="mt-5 md:hidden" />
            <IsoHall seats={seats} selectedId={seatId} onSelect={pickSeat} availability={avail} className="mt-2 hidden md:block md:py-10" />
            <div className="mt-2 hidden flex-wrap gap-5 text-xs text-dim md:flex">
              <span className="flex items-center gap-2">
                <i className="inline-block h-3 w-5 rounded-sm bg-accent" /> свободно
              </span>
              <span className="flex items-center gap-2">
                <i className="inline-block h-3 w-5 rounded-sm shadow-[inset_0_0_0_1.5px_#FF6A3D]" /> занято
              </span>
              <span className="flex items-center gap-2">
                <i className="inline-block h-3 w-5 rounded-sm bg-ink" /> выбрано
              </span>
            </div>
          </section>

          <section id="prices" className="mt-16 scroll-mt-24">
            <H2>Цены</H2>
            <ul className="mt-5 divide-y divide-line">
              {club.tariffs?.map((t: any) => (
                <li key={t.id} className="flex items-baseline justify-between gap-4 py-4">
                  <div>
                    <p className="text-lg font-bold text-ink">{t.name}</p>
                    <p className="mono text-xs uppercase text-dim">
                      {club.zones?.find((z: any) => z.id === t.zoneId)?.name ?? "Весь зал"} · мин. {t.minMinutes} мин
                    </p>
                  </div>
                  <p className="display text-[36px] text-coral">
                    {formatByn(t.pricePerHourKopecks)}
                    <span className="ml-1 font-sans text-sm font-semibold normal-case tracking-normal text-dim">/ч</span>
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-dim">Списание поминутное с баланса. Пакеты и ночные тарифы — у администратора.</p>
          </section>

          <section id="hardware" className="mt-16 scroll-mt-24">
            <H2>Железо</H2>
            {hardware.length === 0 ? (
              <p className="mt-3 text-dim">Клуб ещё не указал характеристики.</p>
            ) : (
              <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                {hardware.map((h) => (
                  <li key={h.id} className="glass rounded-xl p-6">
                    <p className="display text-[32px] text-ink">{h.name}</p>
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                      {[
                        ["Процессор", h.cpu],
                        ["Видеокарта", h.gpu],
                        ["Память", h.ram],
                        ["Монитор", h.monitor],
                      ]
                        .filter(([, v]) => v)
                        .map(([k, v]) => (
                          <div key={k} className="contents">
                            <dt className="text-dim">{k}</dt>
                            <dd className="text-ink">{v}</dd>
                          </div>
                        ))}
                    </dl>
                    <p className="mono mt-3 text-xs uppercase text-dim">
                      {seats.filter((s: any) => s.hardwareProfileId === h.id).length} мест
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="services" className="mt-16 scroll-mt-24">
            <H2>Услуги</H2>
            <ul className="mt-5 flex flex-wrap gap-2">
              {amenities.map((a) => (
                <li key={a} className="rounded-md bg-white/5 px-4 py-2.5 text-sm font-semibold text-ink">
                  {AMENITY[a] ?? a}
                </li>
              ))}
              {club.lockersFree != null && (
                <li className="rounded-md bg-white/5 px-4 py-2.5 text-sm font-semibold text-ink">Шкафчики: {club.lockersFree}</li>
              )}
            </ul>
            {club.products?.length > 0 && (
              <ul className="mt-6 divide-y divide-line text-sm">
                {club.products.slice(0, 8).map((p: any) => (
                  <li key={p.id} className="flex justify-between py-3">
                    <span className="text-ink">{p.name}</span>
                    <span className="mono text-coral">{formatByn(p.priceKopecks)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {tournaments.length > 0 && (
            <section className="mt-16">
              <H2>Турниры</H2>
              <ul className="mt-5 divide-y divide-line">
                {tournaments.map((t: any) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-4 text-sm">
                    <div>
                      <p className="text-lg font-bold text-ink">{t.name}</p>
                      <p className="mono text-xs uppercase text-dim">
                        {t.game ? `${t.game} · ` : ""}
                        {new Date(t.startsAt).toLocaleString("ru-BY", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} ·{" "}
                        {t.status === "OPEN" ? "открыта запись" : t.status === "RUNNING" ? "идёт" : "завершён"}
                      </p>
                    </div>
                    <JoinTournament id={t.id} open={t.status === "OPEN"} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section id="reviews" className="mt-16 scroll-mt-24">
            <H2>Отзывы</H2>
            <ul className="mt-5 divide-y divide-line">
              {(club.reviews ?? []).map((r: any) => (
                <li key={r.id} className="py-4 text-sm">
                  <p className="text-coral">
                    {"★".repeat(r.rating)}
                    <span className="text-ink/20">{"★".repeat(5 - r.rating)}</span>
                    <span className="ml-3 font-semibold text-ink">{r.user?.displayName}</span>
                  </p>
                  <p className="mt-1 text-dim">{r.text}</p>
                </li>
              ))}
              {(club.reviews ?? []).length === 0 && <li className="py-4 text-dim">Отзывов нет</li>}
            </ul>
            <ReviewForm clubId={club.id} />
          </section>
        </div>

        {/* desktop panel */}
        <div className="hidden xl:block">
          <BookingDesk club={club} selectedSeatId={seatId} onAvailability={onAvailability} />
        </div>
      </div>

      {/* mobile / tablet sheet */}
      <div className="fixed inset-x-3 bottom-[84px] z-40 md:bottom-4 xl:hidden">
        {!sheet && (
          <button type="button" onClick={() => setSheet(true)} className="btn-hud w-full justify-between px-6 shadow-lift">
            <span>Бронь</span>
            <span className="mono text-base normal-case">{minPrice != null ? formatByn(minPrice) : ""}</span>
          </button>
        )}
      </div>
      {sheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-base/70 backdrop-blur-sm xl:hidden" onClick={() => setSheet(false)}>
          <div className="max-h-[90vh] overflow-y-auto p-3" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setSheet(false)} className="btn-login mb-2 w-full justify-center text-dim">
              Закрыть
            </button>
            <BookingDesk club={club} selectedSeatId={seatId} onAvailability={onAvailability} />
          </div>
        </div>
      )}
    </div>
  );
}
