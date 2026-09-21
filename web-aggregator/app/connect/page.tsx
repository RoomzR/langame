"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, token } from "@/lib/api";
import { MARKET } from "@/lib/money";

export default function ConnectClubPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    slug: "",
    city: "Минск",
    address: "",
  });
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!token()) {
      router.push("/login");
      return;
    }
    try {
      const slug =
        form.slug ||
        form.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-|-$/g, "") ||
        `club-${Date.now()}`;
      await api("/api/v1/clubs", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          slug,
          city: form.city,
          address: form.address,
        }),
      });
      router.push("/club-admin?tab=dash");
    } catch (err: any) {
      setError(err.message === "UNAUTHORIZED" ? "Сначала войдите" : "Не удалось подключить клуб");
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-md pb-24">
      <h1 className="display text-[56px] text-ink md:text-[80px]">Клуб в сеть</h1>
      <p className="mt-3 text-dim">Вы становитесь владельцем точки: зал, касса, сотрудники и тарифы в Br.</p>
      <label className="mt-8 block text-sm text-dim" htmlFor="name">
        Название
      </label>
      <input id="name" className="field-hud mt-1" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <label className="mt-4 block text-sm text-dim" htmlFor="city">
        Город
      </label>
      <select id="city" className="field-hud mt-1" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>
        {MARKET.cities.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <label className="mt-4 block text-sm text-dim" htmlFor="address">
        Адрес
      </label>
      <input id="address" className="field-hud mt-1" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      <button className="btn-hud mt-6 w-full">Подключить</button>
      {error && <p className="error-hud mt-4 text-sm">{error}</p>}
      <p className="mt-6 text-sm text-dim">
        Нет аккаунта?{" "}
        <Link className="link-coral" href="/register">
          Регистрация
        </Link>
      </p>
    </form>
  );
}
