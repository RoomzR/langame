import { API } from "@/lib/api";

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = await fetch(`${API}/api/v1/news/${slug}`, { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return <p className="text-dim">Статья не найдена</p>;
  const n = await res.json();
  return (
    <article className="max-w-2xl">
      <h1 className="display text-[48px] text-ink md:text-[80px]">{n.title}</h1>
      <p className="mt-8 whitespace-pre-wrap text-lg leading-7 text-dim">{n.body}</p>
    </article>
  );
}
