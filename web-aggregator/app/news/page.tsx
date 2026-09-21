import { API } from "@/lib/api";
import Link from "next/link";

export default async function NewsPage() {
  const res = await fetch(`${API}/api/v1/news`, { cache: "no-store" }).catch(() => null);
  const items = res?.ok ? await res.json() : [];
  return (
    <div>
      <h1 className="display text-[56px] text-ink md:text-[96px]">Новости</h1>
      <ul className="mt-10 max-w-3xl divide-y divide-line">
        {items.map((n: any) => (
          <li key={n.id} className="py-6">
            <Link href={`/news/${n.slug}`} className="display text-[36px] text-ink hover:text-coral md:text-[48px]">
              {n.title}
            </Link>
            <p className="mt-2 text-dim">{n.excerpt}</p>
          </li>
        ))}
        {items.length === 0 && <li className="py-8 text-dim">Пока тихо</li>}
      </ul>
    </div>
  );
}
