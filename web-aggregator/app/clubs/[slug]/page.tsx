import { API } from "@/lib/api";
import { ClubExperience } from "@/components/club-experience";

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = await fetch(`${API}/api/v1/clubs/${slug}`, { cache: "no-store" }).catch(() => null);
  if (!res?.ok) {
    return <p className="text-dim">Клуб не найден. Проверьте, что API запущен.</p>;
  }
  const club = await res.json();
  const tRes = await fetch(`${API}/api/v1/clubs/${club.id}/tournaments`, { cache: "no-store" }).catch(() => null);
  const tournaments = tRes?.ok ? await tRes.json() : [];
  return <ClubExperience club={club} tournaments={tournaments} />;
}
