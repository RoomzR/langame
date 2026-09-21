"use client";

import { useEffect, useState } from "react";

export function Ticker({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const [leaving, setLeaving] = useState<number | null>(null);

  useEffect(() => {
    if (value === shown) return;
    setLeaving(shown);
    setShown(value);
    const t = window.setTimeout(() => setLeaving(null), 120);
    return () => window.clearTimeout(t);
  }, [value, shown]);

  return (
    <span className="relative inline-block overflow-hidden align-bottom">
      {leaving != null && <span className="tick-out absolute inset-0">{leaving}</span>}
      <span className={`inline-block ${leaving != null ? "tick-in" : ""}`}>{shown}</span>
    </span>
  );
}
