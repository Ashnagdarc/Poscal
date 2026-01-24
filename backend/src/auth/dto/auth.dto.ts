import { IsOptional, IsString } from 'class-validator';

export class ValidateTokenDto {
  @IsString()
  token: string;
}

export class UserPayloadDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  aud?: string;

  // Raw JWT payload for debugging / downstream use
  raw?: Record<string, any>;
}
