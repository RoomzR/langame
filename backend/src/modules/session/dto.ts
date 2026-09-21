import { BillingMode } from '@prisma/client';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class StartSessionDto {
  @IsString()
  seatId: string;

  @IsString()
  userId: string;

  @IsString()
  tariffId: string;

  @IsOptional()
  billingMode?: BillingMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  prepaidMinutes?: number;

  @IsOptional()
  @IsString()
  bookingId?: string;
}

export class ExtendSessionDto {
  @IsInt()
  @Min(1)
  minutes: number;
}

export class TransferSessionDto {
  @IsString()
  toSeatId: string;
}
