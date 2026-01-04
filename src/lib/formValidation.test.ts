import { describe, it, expect } from 'vitest';
import { NewTradeFormSchema, SignalFormSchema, AccountFormSchema, PnLInputSchema } from '@/lib/formValidation';

describe('formValidation', () => {
  describe('NewTradeFormSchema', () => {
    it('should validate a valid long trade', () => {
      const validTrade = {
        pair: 'EUR/USD',
        direction: 'long',
        entry_price: '1.1000',
        stop_loss: '1.0950',
        take_profit: '1.1100',
        position_size: '1000',
        risk_percent: '2',
        notes: 'Test trade',
      };

      const result = NewTradeFormSchema.safeParse(validTrade);
      expect(result.success).toBe(true);
    });

    it('should validate a valid short trade', () => {
      const validTrade = {
        pair: 'GBP/JPY',
        direction: 'short',
        entry_price: '150.50',
        stop_loss: '151.00',
        take_profit: '149.50',
        position_size: '500',
        risk_percent: '1.5',
      };

      const result = NewTradeFormSchema.safeParse(validTrade);
      expect(result.success).toBe(true);
    });

    it('should reject invalid currency pair format', () => {
      const invalidTrade = {
        pair: 'INVALID',
        direction: 'long',
        entry_price: '1.1000',
      };

      const result = NewTradeFormSchema.safeParse(invalidTrade);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid pair format');
      }
    });

    it('should reject negative prices', () => {
      const invalidTrade = {
        pair: 'EUR/USD',
        direction: 'long',
        entry_price: '-1.1000',
      };

      const result = NewTradeFormSchema.safeParse(invalidTrade);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Must be greater than 0');
      }
    });

    it('should reject invalid direction', () => {
      const invalidTrade = {
        pair: 'EUR/USD',
        direction: 'sideways',
        entry_price: '1.1000',
      };

      const result = NewTradeFormSchema.safeParse(invalidTrade);
      expect(result.success).toBe(false);
    });
  });

  describe('SignalFormSchema', () => {
    it('should validate a valid signal', () => {
      const validSignal = {
        currency_pair: 'USD/JPY',
        direction: 'buy',
        entry_price: 110.50,
        stop_loss: 109.50,
        take_profit_1: 112.50,
        notes: 'Bullish breakout',
      };

      const result = SignalFormSchema.safeParse(validSignal);
      expect(result.success).toBe(true);
    });

    it('should accept signal without notes', () => {
      const validSignal = {
        currency_pair: 'EUR/GBP',
        direction: 'sell',
        entry_price: 0.8500,
        stop_loss: 0.8550,
        take_profit_1: 0.8400,
      };

      const result = SignalFormSchema.safeParse(validSignal);
      expect(result.success).toBe(true);
    });
  });

  describe('AccountFormSchema', () => {
    it('should validate a valid account', () => {
      const validAccount = {
        account_name: 'Live Account',
        initial_balance: '10000',
        platform: 'MetaTrader 5',
        currency: 'USD',
      };

      const result = AccountFormSchema.safeParse(validAccount);
      expect(result.success).toBe(true);
    });

    it('should reject negative balance', () => {
      const invalidAccount = {
        account_name: 'Test Account',
        initial_balance: '-1000',
        platform: 'cTrader',
        currency: 'USD',
      };

      const result = AccountFormSchema.safeParse(invalidAccount);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Must be greater than 0');
      }
    });

    it('should require all fields', () => {
      const invalidAccount = {
        account_name: 'Test Account',
      };

      const result = AccountFormSchema.safeParse(invalidAccount);
      expect(result.success).toBe(false);
    });
  });

  describe('PnLInputSchema', () => {
    it('should validate positive P&L', () => {
      const validInput = {
        pnl: '150.50',
      };

      const result = PnLInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate negative P&L', () => {
      const validInput = {
        pnl: '-75.25',
      };

      const result = PnLInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate zero P&L', () => {
      const validInput = {
        pnl: '0',
      };

      const result = PnLInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject non-numeric values', () => {
      const invalidInput = {
        pnl: 'abc',
      };

      const result = PnLInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });
});
