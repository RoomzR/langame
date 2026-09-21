import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { SeatStatus, SeatType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateOrganizationDto {
  @IsString()
  name: string;
}

export class CreateClubDto {
  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsString()
  slug: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  city: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsArray()
  amenities?: string[];
}

export class UpdateClubDto {
  @IsOptional()
  @IsString()
  name?: string;
  @IsOptional()
  @IsString()
  description?: string;
  @IsOptional()
  @IsString()
  city?: string;
  @IsOptional()
  @IsString()
  address?: string;
  @IsOptional()
  @IsNumber()
  lat?: number;
  @IsOptional()
  @IsNumber()
  lng?: number;
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
  @IsOptional()
  @IsArray()
  amenities?: string[];
  @IsOptional()
  modules?: Record<string, boolean>;
}

export class CreateZoneDto {
  @IsString()
  name: string;
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
  @IsOptional()
  @IsString()
  color?: string;
}

export class CreateSeatDto {
  @IsString()
  label: string;
  @IsOptional()
  type?: SeatType;
  @IsOptional()
  @IsNumber()
  posX?: number;
  @IsOptional()
  @IsNumber()
  posY?: number;
  @IsOptional()
  @IsString()
  hardwareProfileId?: string;
}

export class UpdateSeatDto {
  @IsOptional()
  status?: SeatStatus;
  @IsOptional()
  @IsNumber()
  posX?: number;
  @IsOptional()
  @IsNumber()
  posY?: number;
  @IsOptional()
  @IsString()
  label?: string;
}

export class CreateTariffDto {
  @IsString()
  name: string;
  @Type(() => Number)
  @Min(0)
  pricePerHourKopecks: number;
  @IsOptional()
  @IsString()
  zoneId?: string;
  @IsOptional()
  @Type(() => Number)
  minMinutes?: number;
}

export class CreateHardwareDto {
  @IsString()
  name: string;
  @IsOptional()
  @IsString()
  cpu?: string;
  @IsOptional()
  @IsString()
  gpu?: string;
  @IsOptional()
  @IsString()
  ram?: string;
  @IsOptional()
  @IsString()
  monitor?: string;
}

export class ClubQueryDto {
  @IsOptional()
  @IsString()
  city?: string;
  @IsOptional()
  @IsString()
  q?: string;
  @IsOptional()
  @Type(() => Number)
  lat?: number;
  @IsOptional()
  @Type(() => Number)
  lng?: number;
}
