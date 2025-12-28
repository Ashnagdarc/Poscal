import { z } from 'zod';

// Schema for validating imported trades from CSV
export const TradeImportSchema = z.object({
  pair: z.string()
    .min(1, "Pair is required")
    .max(20, "Pair must be less than 20 characters")
    .transform(val => val.toUpperCase()),
  direction: z.enum(['long', 'short'], {
    errorMap: () => ({ message: "Direction must be 'long' or 'short'" })
  }),
  entry_price: z.number().positive().optional().nullable(),
  exit_price: z.number().positive().optional().nullable(),
  stop_loss: z.number().positive().optional().nullable(),
  take_profit: z.number().positive().optional().nullable(),
  position_size: z.number().positive().max(1000000, "Position size too large").optional().nullable(),
  risk_percent: z.number().min(0).max(100, "Risk percent must be between 0-100").optional().nullable(),
  pnl: z.number().min(-10000000).max(10000000, "P&L value too large").optional().nullable(),
  status: z.enum(['open', 'closed', 'cancelled']).default('open'),
  notes: z.string().max(1000, "Notes must be less than 1000 characters").optional().nullable(),
  entry_date: z.string().optional().nullable(),
});

export type ValidatedTrade = z.infer<typeof TradeImportSchema>;

// Maximum trades per import
export const MAX_TRADES_PER_IMPORT = 1000;

// Validate a single trade
export function validateTrade(trade: unknown): { success: true; data: ValidatedTrade } | { success: false; error: string } {
  const result = TradeImportSchema.safeParse(trade);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessage = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
  return { success: false, error: errorMessage };
}

// Validate multiple trades
export function validateTrades(trades: unknown[]): { 
  validTrades: ValidatedTrade[]; 
  errors: string[];
  totalRejected: number;
} {
  const validTrades: ValidatedTrade[] = [];
  const errors: string[] = [];
  let totalRejected = 0;

  // Check max import limit
  if (trades.length > MAX_TRADES_PER_IMPORT) {
    errors.push(`Cannot import more than ${MAX_TRADES_PER_IMPORT} trades at once. Found ${trades.length} trades.`);
    return { validTrades: [], errors, totalRejected: trades.length };
  }

  for (let i = 0; i < trades.length; i++) {
    const result = validateTrade(trades[i]);
    if (result.success === false) {
      errors.push(`Row ${i + 1}: ${result.error}`);
      totalRejected++;
    } else {
      validTrades.push(result.data);
    }
  }

  return { validTrades, errors, totalRejected };
}
