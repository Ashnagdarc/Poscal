import { z } from 'zod';

/**
 * Form validation schemas for Journal forms
 */

export const NewTradeFormSchema = z.object({
  pair: z.string()
    .min(1, "Currency pair is required")
    .max(20, "Pair name too long")
    .regex(/^[A-Z]{3}\/[A-Z]{3}$|^[A-Z]{3,6}\/[A-Z]{3}$/, "Invalid pair format (e.g., EUR/USD)"),
  direction: z.enum(['long', 'short'], {
    errorMap: () => ({ message: "Direction must be 'long' or 'short'" })
  }),
  entry_price: z.string()
    .optional()
    .refine(val => !val || !isNaN(parseFloat(val)), "Must be a valid number")
    .refine(val => !val || parseFloat(val) > 0, "Must be greater than 0"),
  stop_loss: z.string()
    .optional()
    .refine(val => !val || !isNaN(parseFloat(val)), "Must be a valid number")
    .refine(val => !val || parseFloat(val) > 0, "Must be greater than 0"),
  take_profit: z.string()
    .optional()
    .refine(val => !val || !isNaN(parseFloat(val)), "Must be a valid number")
    .refine(val => !val || parseFloat(val) > 0, "Must be greater than 0"),
  position_size: z.string()
    .optional()
    .refine(val => !val || !isNaN(parseFloat(val)), "Must be a valid number")
    .refine(val => !val || parseFloat(val) > 0, "Must be greater than 0"),
  risk_percent: z.string()
    .optional()
    .refine(val => !val || !isNaN(parseFloat(val)), "Must be a valid number")
    .refine(val => !val || (parseFloat(val) >= 0 && parseFloat(val) <= 100), "Must be between 0-100"),
  notes: z.string().max(1000, "Notes too long (max 1000 characters)").optional(),
});

const SignalPriceField = z.union([z.string(), z.number()])
  .refine(val => String(val).trim().length > 0, "Price is required")
  .refine(val => !isNaN(parseFloat(String(val))), "Must be a valid number")
  .refine(val => parseFloat(String(val)) > 0, "Must be greater than 0");

const OptionalSignalPriceField = z.union([z.string(), z.number()])
  .optional()
  .refine(val => val === undefined || String(val).trim() === '' || !isNaN(parseFloat(String(val))), "Must be a valid number")
  .refine(val => val === undefined || String(val).trim() === '' || parseFloat(String(val)) > 0, "Must be greater than 0");

export const SignalFormSchema = z.object({
  currency_pair: z.string()
    .min(1, "Currency pair is required")
    .max(20, "Pair name too long"),
  order_type: z.enum(['buy', 'sell', 'buy_limit', 'sell_limit', 'buy_stop', 'sell_stop']).optional(),
  direction: z.enum(['buy', 'sell']).optional(),
  entry_price: OptionalSignalPriceField,
  stop_loss: SignalPriceField,
  take_profit_1: SignalPriceField,
  take_profit_2: OptionalSignalPriceField,
  take_profit_3: OptionalSignalPriceField,
  trading_view_url: z.string().url("Must be a valid URL").or(z.literal('')).optional(),
  chart_image_url: z.string().optional(),
  notes: z.string().max(1000, "Notes too long").optional(),
});

export const AccountFormSchema = z.object({
  account_name: z.string()
    .min(1, "Account name is required")
    .max(50, "Account name too long"),
  platform: z.string()
    .min(1, "Platform is required")
    .max(50, "Platform name too long"),
  initial_balance: z.string()
    .refine(val => !isNaN(parseFloat(val)), "Must be a valid number")
    .refine(val => parseFloat(val) > 0, "Must be greater than 0")
    .transform(val => parseFloat(val)),
  currency: z.string().min(3).max(3, "Currency code must be 3 letters"),
});

export const PnLInputSchema = z.object({
  pnl: z.string()
    .refine(val => !isNaN(parseFloat(val)), "Must be a valid number")
    .transform(val => parseFloat(val)),
  pnl_percent: z.string()
    .optional()
    .refine(val => !val || !isNaN(parseFloat(val)), "Must be a valid number")
    .refine(val => !val || Math.abs(parseFloat(val)) <= 100, "Percentage too large"),
});

export type NewTradeForm = z.infer<typeof NewTradeFormSchema>;
export type SignalForm = z.infer<typeof SignalFormSchema>;
export type AccountForm = z.infer<typeof AccountFormSchema>;
export type PnLInput = z.infer<typeof PnLInputSchema>;
