export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      app_updates: {
        Row: {
          created_at: string | null
          description: string
          id: string
          is_active: boolean | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          is_active?: boolean | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          is_active?: boolean | null
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      taken_trades: {
        Row: {
          id: string
          user_id: string
          account_id: string
          signal_id: string
          risk_percent: number
          risk_amount: number
          status: string
          result: string | null
          pnl: number | null
          pnl_percent: number | null
          closed_at: string | null
          journaled: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          account_id: string
          signal_id: string
          risk_percent: number
          risk_amount: number
          status?: string
          result?: string | null
          pnl?: number | null
          pnl_percent?: number | null
          closed_at?: string | null
          journaled?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          account_id?: string
          signal_id?: string
          risk_percent?: number
          risk_amount?: number
          status?: string
          result?: string | null
          pnl?: number | null
          pnl_percent?: number | null
          closed_at?: string | null
          journaled?: boolean
          created_at?: string | null
        }
        Relationships: []
      }
      trading_accounts: {
        Row: {
          id: string
          user_id: string
          account_name: string
          platform: string
          initial_balance: number
          current_balance: number
          currency: string
          is_active: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          account_name: string
          platform: string
          initial_balance: number
          current_balance: number
          currency?: string
          is_active?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          account_name?: string
          platform?: string
          initial_balance?: number
          current_balance?: number
          currency?: string
          is_active?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      trading_journal: {
        Row: {
          account_id: string | null
          created_at: string | null
          direction: string
          entry_date: string | null
          entry_price: number | null
          exit_date: string | null
          exit_price: number | null
          id: string
          notes: string | null
          pair: string
          pnl: number | null
          pnl_percent: number | null
          position_size: number | null
          risk_percent: number | null
          status: string | null
          stop_loss: number | null
          take_profit: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          direction: string
          entry_date?: string | null
          entry_price?: number | null
          exit_date?: string | null
          exit_price?: number | null
          id?: string
          notes?: string | null
          pair: string
          pnl?: number | null
          pnl_percent?: number | null
          position_size?: number | null
          risk_percent?: number | null
          status?: string | null
          stop_loss?: number | null
          take_profit?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          direction?: string
          entry_date?: string | null
          entry_price?: number | null
          exit_date?: string | null
          exit_price?: number | null
          id?: string
          notes?: string | null
          pair?: string
          pnl?: number | null
          pnl_percent?: number | null
          position_size?: number | null
          risk_percent?: number | null
          status?: string | null
          stop_loss?: number | null
          take_profit?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trading_signals: {
        Row: {
          chart_image_url: string | null
          closed_at: string | null
          created_at: string | null
          currency_pair: string
          direction: string
          entry_price: number
          id: string
          notes: string | null
          pips_to_sl: number
          pips_to_tp1: number
          pips_to_tp2: number | null
          pips_to_tp3: number | null
          result: string | null
          status: string
          stop_loss: number
          take_profit_1: number
          take_profit_2: number | null
          take_profit_3: number | null
          tp1_hit: boolean | null
          tp2_hit: boolean | null
          tp3_hit: boolean | null
        }
        Insert: {
          chart_image_url?: string | null
          closed_at?: string | null
          created_at?: string | null
          currency_pair: string
          direction: string
          entry_price: number
          id?: string
          notes?: string | null
          pips_to_sl: number
          pips_to_tp1: number
          pips_to_tp2?: number | null
          pips_to_tp3?: number | null
          result?: string | null
          status?: string
          stop_loss: number
          take_profit_1: number
          take_profit_2?: number | null
          take_profit_3?: number | null
          tp1_hit?: boolean | null
          tp2_hit?: boolean | null
          tp3_hit?: boolean | null
        }
        Update: {
          chart_image_url?: string | null
          closed_at?: string | null
          created_at?: string | null
          currency_pair?: string
          direction?: string
          entry_price?: number
          id?: string
          notes?: string | null
          pips_to_sl?: number
          pips_to_tp1?: number
          pips_to_tp2?: number | null
          pips_to_tp3?: number | null
          result?: string | null
          status?: string
          stop_loss?: number
          take_profit_1?: number
          take_profit_2?: number | null
          take_profit_3?: number | null
          tp1_hit?: boolean | null
          tp2_hit?: boolean | null
          tp3_hit?: boolean | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_user_admin: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      get_all_users_admin: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          email: string
          id: string
          is_admin: boolean
          is_banned: boolean
          last_sign_in_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      toggle_user_ban: {
        Args: { ban_status: boolean; target_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
