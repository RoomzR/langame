import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class MockTopupDto {
  @IsInt()
  @Min(1)
  amountKopecks: number;
}

export class AdminTopupDto {
  @IsInt()
  @Min(1)
  amountKopecks: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CheckoutDto {
  @IsInt()
  @Min(100)
  amountKopecks: number;

  @IsIn(['bepaid', 'erip'])
  method: 'bepaid' | 'erip';
}

export class BepaidWebhookDto {
  @IsOptional()
  @IsString()
  uid?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  amount?: number;
}

export class BonusDto {
  @IsInt()
  @Min(1)
  amountKopecks: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class RedeemBonusDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  amountKopecks?: number;
}

export class CashInDto {
  @IsInt()
  @Min(1)
  amountKopecks: number;

  @IsIn(['CASH', 'CARD', 'ERIP'])
  method: 'CASH' | 'CARD' | 'ERIP';

  @IsOptional()
  @IsString()
  receiptNo?: string;

  @IsOptional()
  @IsString()
  guestName?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CashPostDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  guestName?: string;

  @IsOptional()
  @IsString()
  guestPhone?: string;
}
