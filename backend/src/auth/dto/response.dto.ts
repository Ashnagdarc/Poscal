export class ProfileResponseDto {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export class UserPayloadDto {
  id: string;
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
}
