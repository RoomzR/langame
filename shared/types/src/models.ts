export type Uuid = string;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserProfile {
  id: Uuid;
  phone: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  locale: string;
  globalRole: string;
}

export interface SeatMapItem {
  id: Uuid;
  clubId: Uuid;
  zoneId: Uuid;
  zoneName: string;
  label: string;
  type: string;
  status: string;
  posX: number;
  posY: number;
  guestName: string | null;
  remainingSeconds: number | null;
  balanceKopecks: number | null;
  sessionId: string | null;
}

export interface SessionSnapshot {
  id: Uuid;
  clubId: Uuid;
  seatId: Uuid;
  userId: Uuid;
  tariffId: Uuid;
  status: string;
  billingMode: string;
  remainingSeconds: number | null;
  totalChargedKopecks: number;
  startedAt: string;
  lastTickAt: string | null;
}

export interface ClubSummary {
  id: Uuid;
  slug: string;
  name: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  ratingAvg: number;
  ratingCount: number;
  minPricePerHourKopecks: number | null;
  freeSeats: number;
  totalSeats: number;
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  code?: string;
}
