"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API, setTokens } from "@/lib/api";
import { homeAfterLogin, type MeUser } from "@/lib/roles";

const DEMOS: { label: string; phone: string; password: string }[] = [
  { label: "Гость", phone: "+375291000004", password: "guest123" },
  { label: "Кассир", phone: "+375291000007", password: "cash123" },
  { label: "Смена", phone: "+375291000003", password: "admin123" },
  { label: "Тех.админ", phone: "+375291000005", password: "tech123" },
  { label: "Владелец", phone: "+375291000002", password: "owner123" },
  { label: "Сеть", phone: "+375291000001", password: "admin123" },
];

export function AuthStage({ mode }: { mode: "login" | "register" }) {
  const [phone, setPhone] = useState("+375");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const login = mode === "login";

  useEffect(() => {
    setLive(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const path = login ? "/api/v1/auth/login" : "/api/v1/auth/register";
      const body = login ? { phone, password } : { phone, password, displayName };
      const res = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = data?.code;
        setError(
          code === "INVALID_CREDENTIALS"
            ? "Вход не прошёл. Повторить"
            : code === "PHONE_TAKEN"
              ? "Телефон занят"
              : "Связь потеряна. Повторить",
        );
        return;
      }
      setTokens(data.accessToken, data.refreshToken);
      if (!login) {
        window.location.assign("/cabinet");
        return;
      }
      const me = await fetch(`${API}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${data.accessToken}` },
      }).then((r) => r.json() as Promise<MeUser>);
      window.location.assign(homeAfterLogin(me));
    } catch {
      setError("Связь потеряна. Повторить");
    } finally {
      setBusy(false);
    }
  }

  function fillDemo(d: (typeof DEMOS)[number]) {
    setPhone(d.phone);
    setPassword(d.password);
    setError("");
  }

  return (
    <section className="auth-stage">
      <p className="auth-mark" aria-hidden>
        RM
      </p>
      <div className="auth-grid">
        <div className="auth-copy">
          <Link href="/" className="display text-[28px] text-white">
            Rudemir
          </Link>
          <h1 className="display mt-10 text-[72px] text-white md:text-[120px]">{login ? "Вход" : "Регистрация"}</h1>
          <p className="mt-6 max-w-[22rem] text-lg leading-relaxed text-white/75">
            Один аккаунт на все клубы сети. Баланс в Br, бронь и карта гостя едут с вами.
          </p>
          {live && login && (
            <ul className="auth-roles mt-10 hidden md:flex">
              {DEMOS.map((d) => (
                <li key={d.phone}>
                  <button type="button" className="auth-chip" onClick={() => fillDemo(d)}>
                    {d.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={submit} className="auth-panel" autoComplete="on">
          <div className="auth-panel-inner">
            {!live ? (
              <div className="min-h-[360px]" aria-hidden />
            ) : (
              <>
                <p className="display text-[48px] text-[#050505] md:text-[56px]">{login ? "Карта" : "Новая карта"}</p>
                <p className="mt-2 text-sm text-[#6b6f7a]">{login ? "Телефон и пароль одной сети." : "Имя, телефон и пароль. Потом бронь в любом клубе."}</p>
                {!login && (
                  <>
                    <label className="mt-8 block text-sm text-[#6b6f7a]" htmlFor="name">
                      Имя в клубе
                    </label>
                    <input
                      id="name"
                      name="name"
                      className="auth-field"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                    />
                  </>
                )}
                <label className={`${login ? "mt-8" : "mt-5"} block text-sm text-[#6b6f7a]`} htmlFor="phone">
                  Телефон
                </label>
                <input
                  id="phone"
                  name="phone"
                  className="auth-field"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                  required
                />
                <label className="mt-5 block text-sm text-[#6b6f7a]" htmlFor="password">
                  {login ? "Пароль" : "Пароль (от 6 символов)"}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  className="auth-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={login ? "current-password" : "new-password"}
                  required
                  minLength={login ? 1 : 6}
                />
                <button className="btn-hud mt-10 w-full" disabled={busy}>
                  {busy ? "Вход…" : login ? "Войти" : "Регистрация"}
                </button>
                {error && (
                  <p className="error-hud mt-4 text-sm" role="alert">
                    {error}
                  </p>
                )}
                <p className="mt-6 text-sm text-[#6b6f7a]">
                  {login ? (
                    <>
                      Нет аккаунта?{" "}
                      <Link className="font-semibold text-[#2015ff]" href="/register">
                        Регистрация
                      </Link>
                    </>
                  ) : (
                    <>
                      Уже есть аккаунт?{" "}
                      <Link className="font-semibold text-[#2015ff]" href="/login">
                        Войти
                      </Link>
                    </>
                  )}
                </p>
                {login && (
                  <ul className="auth-roles mt-8 flex md:hidden">
                    {DEMOS.map((d) => (
                      <li key={d.phone}>
                        <button type="button" className="auth-chip dark" onClick={() => fillDemo(d)}>
                          {d.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
