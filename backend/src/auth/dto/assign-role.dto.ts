import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { AppRole } from '../entities/user-role.entity';

export class AssignRoleDto {
  @IsUUID()
  @IsNotEmpty()
  user_id: string;

  @IsEnum(AppRole)
  @IsNotEmpty()
  role: AppRole;
}
