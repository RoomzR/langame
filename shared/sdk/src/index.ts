import type { AuthTokens, UserProfile } from '@arenaos/types';

export interface RudemirClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null | Promise<string | null>;
  setTokens?: (tokens: AuthTokens) => void | Promise<void>;
}

export class RudemirApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API ${status}`);
    this.name = 'RudemirApiError';
  }
}

export class RudemirClient {
  constructor(private readonly options: RudemirClientOptions) {}

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.options.getAccessToken?.();
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${this.options.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new RudemirApiError(res.status, data);
    return data as T;
  }

  get<T>(path: string) {
    return this.request<T>('GET', path);
  }
  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body);
  }
  patch<T>(path: string, body?: unknown) {
    return this.request<T>('PATCH', path, body);
  }
  delete<T>(path: string) {
    return this.request<T>('DELETE', path);
  }

  login(phone: string, password: string) {
    return this.post<AuthTokens>('/api/v1/auth/login', { phone, password });
  }
  register(payload: { phone: string; password: string; displayName: string }) {
    return this.post<AuthTokens>('/api/v1/auth/register', payload);
  }
  me() {
    return this.get<UserProfile>('/api/v1/auth/me');
  }
  refresh(refreshToken: string) {
    return this.post<AuthTokens>('/api/v1/auth/refresh', { refreshToken });
  }

  loginCard(cardNumber: string, pin: string) {
    return this.post<AuthTokens>('/api/v1/auth/card', { cardNumber, pin });
  }

  clubs() {
    return this.get<unknown[]>('/api/v1/clubs');
  }

  club(idOrSlug: string) {
    return this.get<unknown>(`/api/v1/clubs/${idOrSlug}`);
  }

  wallet() {
    return this.get<unknown>('/api/v1/me/wallet');
  }

  checkout(amountKopecks: number, method: 'bepaid' | 'erip') {
    return this.post<unknown>('/api/v1/payments/checkout', { amountKopecks, method });
  }

  notifications() {
    return this.get<unknown[]>('/api/v1/notifications');
  }

  friends() {
    return this.get<unknown[]>('/api/v1/me/friends');
  }

  requestFriend(userId: string) {
    return this.post<unknown>('/api/v1/me/friends', { userId });
  }

  achievements() {
    return this.get<unknown[]>('/api/v1/me/achievements');
  }

  callAdmin(clubId: string, seatId: string, message: string) {
    return this.post<unknown>(`/api/v1/clubs/${clubId}/seats/${seatId}/call`, { message });
  }
}

export function createRudemirClient(options: RudemirClientOptions) {
  return new RudemirClient(options);
}
