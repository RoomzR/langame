export const UserRole = {
  GUEST: 'GUEST',
  CLUB_ADMIN: 'CLUB_ADMIN',
  OWNER: 'OWNER',
  SUPERADMIN: 'SUPERADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const SeatType = {
  PC: 'PC',
  CONSOLE: 'CONSOLE',
  VR: 'VR',
} as const;
export type SeatType = (typeof SeatType)[keyof typeof SeatType];

export const SeatStatus = {
  FREE: 'FREE',
  OCCUPIED: 'OCCUPIED',
  OFFLINE: 'OFFLINE',
  MAINTENANCE: 'MAINTENANCE',
  RESERVED: 'RESERVED',
} as const;
export type SeatStatus = (typeof SeatStatus)[keyof typeof SeatStatus];

export const SessionStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ENDED: 'ENDED',
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export const BillingMode = {
  WALLET: 'WALLET',
  PREPAID: 'PREPAID',
} as const;
export type BillingMode = (typeof BillingMode)[keyof typeof BillingMode];

export const BookingStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  NO_SHOW: 'NO_SHOW',
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const TransactionType = {
  TOPUP: 'TOPUP',
  SESSION_CHARGE: 'SESSION_CHARGE',
  REFUND: 'REFUND',
  PURCHASE: 'PURCHASE',
  BONUS: 'BONUS',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const PaymentStatus = {
  PENDING: 'PENDING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const OrderStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  PREPARING: 'PREPARING',
  READY: 'READY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const FriendshipStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  BLOCKED: 'BLOCKED',
} as const;
export type FriendshipStatus = (typeof FriendshipStatus)[keyof typeof FriendshipStatus];

export const LockerStatus = {
  FREE: 'FREE',
  OCCUPIED: 'OCCUPIED',
} as const;
export type LockerStatus = (typeof LockerStatus)[keyof typeof LockerStatus];

export const PcCommand = {
  LOCK: 'LOCK',
  UNLOCK: 'UNLOCK',
  REBOOT: 'REBOOT',
  SHUTDOWN: 'SHUTDOWN',
} as const;
export type PcCommand = (typeof PcCommand)[keyof typeof PcCommand];

export const WsEvent = {
  SeatUpdated: 'seat.updated',
  SessionUpdated: 'session.updated',
  BookingUpdated: 'booking.updated',
  ChatMessage: 'chat.message',
  AdminCall: 'admin.call',
  PcCommand: 'pc.command',
  Notification: 'notification',
} as const;
export type WsEvent = (typeof WsEvent)[keyof typeof WsEvent];
