import { IsBoolean, IsISO8601, IsOptional, IsString } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  seatId: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  tariffId: string;

  @IsISO8601()
  startsAt: string;

  @IsISO8601()
  endsAt: string;

  @IsOptional()
  @IsBoolean()
  autoStartSession?: boolean;

  @IsOptional()
  @IsString()
  guestName?: string;

  @IsOptional()
  @IsString()
  guestPhone?: string;
}

export class RescheduleBookingDto {
  @IsISO8601()
  startsAt: string;

  @IsISO8601()
  endsAt: string;
}
