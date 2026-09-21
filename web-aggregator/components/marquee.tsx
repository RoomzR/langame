export function Marquee({ items }: { items: string[] }) {
  const row = items.map((t, i) => (
    <span key={i} className="flex items-center gap-8 pr-8">
      <span>{t}</span>
      <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-hidden />
    </span>
  ));
  return (
    <div className="marquee display border-y border-line py-3 text-[28px] text-ink/85 md:text-[40px]" aria-label={items.join(", ")}>
      <div className="marquee-track">
        <div className="flex" aria-hidden={false}>
          {row}
        </div>
        <div className="flex" aria-hidden>
          {row}
        </div>
      </div>
    </div>
  );
}
