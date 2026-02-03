import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';

export interface AdminUserRow {
  id: string;
  full_name: string | null;
  email: string;
  is_admin: boolean;
  account_type: string | null;
  created_at: string;
  subscription_tier: string;
  subscription_end: string | null;
}

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async listUsers(): Promise<AdminUserRow[]> {
    const rows = await this.userRepository.query(
      `SELECT
        u.id,
        u.full_name,
        u.email,
        u.is_admin,
        u.account_type,
        u.created_at,
        CASE
          WHEN u.is_admin THEN 'admin'
          WHEN p.subscription_plan IS NOT NULL THEN p.subscription_plan
          WHEN p.subscription_tier IS NOT NULL THEN p.subscription_tier
          ELSE 'free'
        END AS subscription_tier,
        p.subscription_end
      FROM users u
      LEFT JOIN LATERAL (
        SELECT subscription_plan, subscription_tier, subscription_end
        FROM payments
        WHERE user_id = u.id
          AND status = 'success'
          AND subscription_end > NOW()
        ORDER BY subscription_end DESC NULLS LAST
        LIMIT 1
      ) p ON true
      ORDER BY u.created_at DESC`
    );

    return rows as AdminUserRow[];
  }
}
