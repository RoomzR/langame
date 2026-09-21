"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function RouteLine() {
  const path = usePathname();
  const [key, setKey] = useState(0);

  useEffect(() => {
    setKey((n) => n + 1);
  }, [path]);

  if (key === 0) return null;
  return <div key={key} className="route-line" aria-hidden />;
}
