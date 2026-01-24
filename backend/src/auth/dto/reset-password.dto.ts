export class RequestResetDto {
  email: string;
}

export class ResetPasswordDto {
  email: string;
  token: string;
  new_password: string;
}