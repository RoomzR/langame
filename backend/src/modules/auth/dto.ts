import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @Matches(/^\+[0-9]{10,15}$/)
  phone: string;

  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(2)
  displayName: string;
}

export class LoginDto {
  @Matches(/^\+[0-9]{10,15}$/)
  phone: string;

  @IsString()
  password: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}

export class OtpRequestDto {
  @Matches(/^\+[0-9]{10,15}$/)
  phone: string;
}

export class OtpVerifyDto {
  @Matches(/^\+[0-9]{10,15}$/)
  phone: string;

  @IsString()
  code: string;
}

export class CardLoginDto {
  @IsString()
  cardNumber: string;

  @IsString()
  pin: string;
}

export class LogoutDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
