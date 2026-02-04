import { IsEmail, IsString, MinLength } from 'class-validator';

export class RequestResetDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  token: string;

  @IsString()
  @MinLength(6)
  new_password: string;
}
