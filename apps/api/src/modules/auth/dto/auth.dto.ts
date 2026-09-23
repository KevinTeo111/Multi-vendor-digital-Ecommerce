import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  /** Buyers are the default; vendors also get a store record. Admins are never self-registered. */
  @IsOptional()
  @IsIn(['BUYER', 'VENDOR'])
  role?: 'BUYER' | 'VENDOR';

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  storeName?: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(20)
  refreshToken: string;
}
