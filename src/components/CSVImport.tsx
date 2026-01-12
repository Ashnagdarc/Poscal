import { useState, useRef } from 'react';
import { Upload, FileText, X, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { validateTrades, MAX_TRADES_PER_IMPORT } from '@/lib/tradeValidation';

interface ParsedTrade {
  pair: string;
  direction: 'long' | 'short';
  entry_price?: number;
  exit_price?: number;
  stop_loss?: number;
  take_profit?: number;
  position_size?: number;
  risk_percent?: number;
  pnl?: number;
  status: 'open' | 'closed' | 'cancelled';
  notes?: string;
  entry_date?: string;
}

interface CSVImportProps {
  onImport: (trades: ParsedTrade[]) => Promise<void>;
  onClose: () => void;
}

export const CSVImport = ({ onImport, onClose }: CSVImportProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedTrades, setParsedTrades] = useState<ParsedTrade[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): { trades: ParsedTrade[]; errors: string[] } => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      return { trades: [], errors: ['CSV file must have a header row and at least one data row'] };
    }

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
    const trades: ParsedTrade[] = [];
    const errors: string[] = [];

    // Required columns
    const pairIndex = headers.findIndex(h => ['pair', 'symbol', 'currency', 'instrument'].includes(h));
    const directionIndex = headers.findIndex(h => ['direction', 'side', 'type', 'buy/sell'].includes(h));

    if (pairIndex === -1) {
      return { trades: [], errors: ['Missing required column: pair/symbol'] };
    }

    // Optional columns
    const entryPriceIndex = headers.findIndex(h => ['entry_price', 'entry', 'open_price', 'open'].includes(h));
    const exitPriceIndex = headers.findIndex(h => ['exit_price', 'exit', 'close_price', 'close'].includes(h));
    const stopLossIndex = headers.findIndex(h => ['stop_loss', 'sl', 'stoploss'].includes(h));
    const takeProfitIndex = headers.findIndex(h => ['take_profit', 'tp', 'takeprofit'].includes(h));
    const positionSizeIndex = headers.findIndex(h => ['position_size', 'size', 'lots', 'volume', 'quantity'].includes(h));
    const riskPercentIndex = headers.findIndex(h => ['risk_percent', 'risk', 'risk%'].includes(h));
    const pnlIndex = headers.findIndex(h => ['pnl', 'profit', 'p&l', 'profit_loss', 'result'].includes(h));
    const statusIndex = headers.findIndex(h => ['status', 'state'].includes(h));
    const notesIndex = headers.findIndex(h => ['notes', 'comment', 'comments', 'description'].includes(h));
    const dateIndex = headers.findIndex(h => ['date', 'entry_date', 'open_date', 'time', 'datetime'].includes(h));

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      
      if (values.length < headers.length) {
        errors.push(`Row ${i + 1}: Not enough columns`);
        continue;
      }

      const pair = values[pairIndex]?.toUpperCase();
      if (!pair) {
        errors.push(`Row ${i + 1}: Missing pair/symbol`);
        continue;
      }

      let direction: 'long' | 'short' = 'long';
      if (directionIndex !== -1) {
        const dirValue = values[directionIndex]?.toLowerCase();
        if (['short', 'sell', 's'].includes(dirValue)) {
          direction = 'short';
        }
      }

      let status: 'open' | 'closed' | 'cancelled' = 'open';
      if (statusIndex !== -1) {
        const statusValue = values[statusIndex]?.toLowerCase();
        if (['closed', 'close', 'done'].includes(statusValue)) {
          status = 'closed';
        } else if (['cancelled', 'canceled', 'cancel'].includes(statusValue)) {
          status = 'cancelled';
        }
      }

      const toNumber = (idx: number) => {
        if (idx === -1) return undefined;
        const num = parseFloat(values[idx]);
        return Number.isFinite(num) ? num : undefined;
      };

      const trade: ParsedTrade = {
        pair,
        direction,
        status,
        entry_price: toNumber(entryPriceIndex),
        exit_price: toNumber(exitPriceIndex),
        stop_loss: toNumber(stopLossIndex),
        take_profit: toNumber(takeProfitIndex),
        position_size: toNumber(positionSizeIndex),
        risk_percent: toNumber(riskPercentIndex),
        pnl: toNumber(pnlIndex),
        notes: notesIndex !== -1 ? values[notesIndex] || undefined : undefined,
        entry_date: dateIndex !== -1 ? values[dateIndex] || undefined : undefined,
      };

      trades.push(trade);
    }

    return { trades, errors };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setFile(selectedFile);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const { trades, errors } = parseCSV(text);

      // Schema validation to catch bad rows and NaN values
      const { validTrades, errors: schemaErrors, totalRejected } = validateTrades(trades);

      const combinedErrors = [...errors, ...schemaErrors];
      if (trades.length > MAX_TRADES_PER_IMPORT) {
        combinedErrors.push(`Cannot import more than ${MAX_TRADES_PER_IMPORT} trades at once.`);
      }

      setParsedTrades(validTrades);
      setErrors(combinedErrors);

      if (totalRejected > 0) {
        toast.warning(`${totalRejected} rows were rejected during validation`);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (parsedTrades.length === 0) {
      toast.error('No valid trades to import');
      return;
    }

    setIsImporting(true);
    try {
      await onImport(parsedTrades);
      toast.success(`Imported ${parsedTrades.length} trades`);
      onClose();
    } catch {
      toast.error('Failed to import trades');
    }
    setIsImporting(false);
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col animate-slide-up">
      <header className="pt-12 pb-4 px-6 flex items-center justify-between border-b border-border">
        <h2 className="text-xl font-bold text-foreground">Import Trades</h2>
        <button
          onClick={onClose}
          className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center"
        >
          <X className="w-5 h-5 text-foreground" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* File Upload */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer hover:border-foreground/50 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-foreground font-medium">
            {file ? file.name : 'Click to upload CSV'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Supports: pair, direction, entry_price, exit_price, pnl, notes, etc.
          </p>
        </div>

        {/* Expected Format */}
        <div className="bg-secondary rounded-2xl p-4">
          <p className="text-sm font-medium text-foreground mb-2">Expected CSV Format</p>
          <p className="text-xs text-muted-foreground font-mono">
            pair,direction,entry_price,stop_loss,take_profit,pnl,status,notes
          </p>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            EUR/USD,long,1.0850,1.0800,1.0950,50,closed,Good setup
          </p>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-destructive/10 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <p className="text-sm font-medium text-destructive">Parse Errors</p>
            </div>
            <ul className="text-sm text-destructive space-y-1">
              {errors.slice(0, 5).map((error, i) => (
                <li key={i}>{error}</li>
              ))}
              {errors.length > 5 && (
                <li>...and {errors.length - 5} more errors</li>
              )}
            </ul>
          </div>
        )}

        {/* Parsed Trades Preview */}
        {parsedTrades.length > 0 && (
          <div className="bg-secondary rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-foreground" />
              <p className="text-sm font-medium text-foreground">
                {parsedTrades.length} trades ready to import
              </p>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {parsedTrades.slice(0, 10).map((trade, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-background rounded-xl p-3">
                  <span className="font-medium text-foreground">{trade.pair}</span>
                  <span className={trade.direction === 'long' ? 'text-foreground' : 'text-destructive'}>
                    {trade.direction.toUpperCase()}
                  </span>
                  {trade.pnl !== undefined && (
                    <span className={trade.pnl >= 0 ? 'text-foreground' : 'text-destructive'}>
                      {trade.pnl >= 0 ? '+' : ''}{trade.pnl}
                    </span>
                  )}
                </div>
              ))}
              {parsedTrades.length > 10 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  ...and {parsedTrades.length - 10} more trades
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Import Button */}
      <div className="px-6 pb-8">
        <button
          onClick={handleImport}
          disabled={parsedTrades.length === 0 || isImporting}
          className="w-full h-14 bg-foreground text-background font-semibold rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isImporting ? (
            <>
              <div className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              Import {parsedTrades.length} Trades
            </>
          )}
        </button>
      </div>
    </div>
  );
};