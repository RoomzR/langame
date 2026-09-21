export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
export const AUTH_EVENT = "rudemir-auth";

function notifyAuth() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function token(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("rudemir_token");
}

export function setTokens(access: string, refresh?: string) {
  localStorage.setItem("rudemir_token", access);
  if (refresh) localStorage.setItem("rudemir_refresh", refresh);
  notifyAuth();
}

export function clearTokens() {
  localStorage.removeItem("rudemir_token");
  localStorage.removeItem("rudemir_refresh");
  notifyAuth();
}

function errMessage(data: any, status: number) {
  const m = data?.message;
  if (Array.isArray(m)) return m.join(", ");
  if (typeof m === "string") return m;
  if (data?.code) return String(data.code);
  return `Ошибка ${status}`;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.body ? { "Content-Type": "application/json" } : {}),
    ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
  };
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as any) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errMessage(data, res.status));
  return data as T;
}

export type ClubSummary = {
  id: string;
  slug: string;
  name: string;
  city: string;
  address: string;
  ratingAvg: number;
  ratingCount: number;
  minPricePerHourKopecks: number | null;
  freeSeats: number;
  totalSeats: number;
  coverUrl: string | null;
  amenities: string[];
};
