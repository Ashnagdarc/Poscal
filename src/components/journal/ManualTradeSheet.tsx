import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { JournalTrade } from "@/lib/convexJournal";
import type { ManualTradeInput } from "@/hooks/queries/use-trades-query";
import {
  canonicalizePairSymbol,
  formatPriceForPair,
  getPairPriceDecimals,
  parsePriceInput,
  pricePlaceholderForPair,
  priceStepForPair,
  sanitizePriceInput,
} from "@/lib/pairFormat";
import {
  SUPPORTED_PAIR_SUGGESTIONS,
  formatPairTokenForDisplay,
  validateTradePairInput,
} from "@/lib/supportedPairs";
import { cn } from "@/lib/utils";

interface ManualTradeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade?: JournalTrade | null;
  isSaving?: boolean;
  onSave: (trade: ManualTradeInput) => Promise<void>;
}

type DirectionOption = "long" | "short";

type FormState = {
  pair: string;
  direction: DirectionOption;
  status: ManualTradeInput["status"];
  entry_date: string;
  exit_date: string;
  entry_price: string;
  exit_price: string;
  stop_loss: string;
  take_profit: string;
  position_size: string;
  risk_percent: string;
  pnl: string;
  tags: string;
  notes: string;
};

const toInputDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const toDirection = (value?: string | null): DirectionOption => {
  if (value === "sell" || value === "short") return "short";
  return "long";
};

const emptyForm = (): FormState => ({
  pair: "",
  direction: "long",
  status: "closed",
  entry_date: new Date().toISOString().slice(0, 10),
  exit_date: new Date().toISOString().slice(0, 10),
  entry_price: "",
  exit_price: "",
  stop_loss: "",
  take_profit: "",
  position_size: "",
  risk_percent: "",
  pnl: "",
  tags: "",
  notes: "",
});

const numberToFormValue = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
};

export const ManualTradeSheet = ({
  open,
  onOpenChange,
  trade,
  isSaving = false,
  onSave,
}: ManualTradeSheetProps) => {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showMore, setShowMore] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairSuggestion, setPairSuggestion] = useState<string | null>(null);

  const priceDecimals = useMemo(() => getPairPriceDecimals(form.pair), [form.pair]);
  const pricePlaceholder = useMemo(() => pricePlaceholderForPair(form.pair), [form.pair]);
  const priceStep = useMemo(() => priceStepForPair(form.pair), [form.pair]);
  const isClosed = form.status === "closed";

  useEffect(() => {
    if (!open) return;

    setPairError(null);
    setPairSuggestion(null);

    if (trade) {
      const pair = canonicalizePairSymbol(trade.pair);
      setForm({
        pair,
        direction: toDirection(trade.direction),
        status: trade.status,
        entry_date: toInputDate(trade.entry_date),
        exit_date: toInputDate(trade.exit_date),
        entry_price: formatPriceForPair(trade.entry_price, pair),
        exit_price: formatPriceForPair(trade.exit_price, pair),
        stop_loss: formatPriceForPair(trade.stop_loss, pair),
        take_profit: formatPriceForPair(trade.take_profit, pair),
        position_size: numberToFormValue(trade.position_size),
        risk_percent: numberToFormValue(trade.risk_percent),
        pnl: numberToFormValue(trade.pnl),
        tags: trade.tags ?? "",
        notes: trade.notes ?? "",
      });
      setShowMore(Boolean(trade.notes || trade.tags || trade.risk_percent != null));
      return;
    }

    setForm(emptyForm());
    setShowMore(false);
  }, [open, trade]);

  const updatePriceField = (
    field: "entry_price" | "exit_price" | "stop_loss" | "take_profit",
    raw: string,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: sanitizePriceInput(raw, getPairPriceDecimals(current.pair)),
    }));
  };

  const blurPriceField = (
    field: "entry_price" | "exit_price" | "stop_loss" | "take_profit",
  ) => {
    setForm((current) => {
      const parsed = parsePriceInput(current[field]);
      if (parsed == null) {
        return { ...current, [field]: "" };
      }
      return {
        ...current,
        [field]: formatPriceForPair(parsed, current.pair),
      };
    });
  };

  const applyPairSymbol = (raw: string) => {
    const pair = canonicalizePairSymbol(raw);
    setForm((current) => {
      if (!pair || pair === current.pair) {
        return current.pair === pair ? current : { ...current, pair };
      }

      return {
        ...current,
        pair,
        entry_price: current.entry_price
          ? formatPriceForPair(parsePriceInput(current.entry_price), pair)
          : "",
        exit_price: current.exit_price
          ? formatPriceForPair(parsePriceInput(current.exit_price), pair)
          : "",
        stop_loss: current.stop_loss
          ? formatPriceForPair(parsePriceInput(current.stop_loss), pair)
          : "",
        take_profit: current.take_profit
          ? formatPriceForPair(parsePriceInput(current.take_profit), pair)
          : "",
      };
    });

    if (!pair.trim()) {
      setPairError(null);
      setPairSuggestion(null);
      return;
    }

    const validation = validateTradePairInput(pair);
    if (validation.ok) {
      setPairError(null);
      setPairSuggestion(null);
      return;
    }
    setPairError(validation.message);
    setPairSuggestion(validation.suggestion);
  };

  const handlePairBlur = () => {
    applyPairSymbol(form.pair);
  };

  const acceptPairSuggestion = () => {
    if (!pairSuggestion) return;
    applyPairSymbol(formatPairTokenForDisplay(pairSuggestion));
  };

  const handleSubmit = async () => {
    if (isSaving) return;

    const pair = canonicalizePairSymbol(form.pair);
    const pairValidation = validateTradePairInput(pair);
    if (!pairValidation.ok) {
      setPairError(pairValidation.message);
      setPairSuggestion(pairValidation.suggestion);
      toast.error(pairValidation.message);
      return;
    }

    setPairError(null);
    setPairSuggestion(null);

    const pnlValue = isClosed ? parsePriceInput(form.pnl) : null;
    if (isClosed && (pnlValue === null || !Number.isFinite(pnlValue))) {
      toast.error("Enter P&L so this trade updates your charts and overview");
      return;
    }
    if (pnlValue != null && Math.abs(pnlValue) > 1_000_000) {
      toast.error("P&L looks unrealistic — check the amount");
      return;
    }

    const positionSize = parsePriceInput(form.position_size);
    if (positionSize != null && (positionSize < 0 || positionSize > 1_000)) {
      toast.error("Position size must be between 0 and 1000");
      return;
    }

    await onSave({
      pair,
      direction: form.direction,
      status: form.status,
      entry_price: parsePriceInput(form.entry_price),
      exit_price: isClosed ? parsePriceInput(form.exit_price) : null,
      stop_loss: parsePriceInput(form.stop_loss),
      take_profit: parsePriceInput(form.take_profit),
      position_size: parsePriceInput(form.position_size),
      risk_percent: parsePriceInput(form.risk_percent),
      pnl: pnlValue,
      notes: form.notes.trim() || null,
      tags: form.tags.trim() || null,
      market_condition: null,
      entry_date: form.entry_date ? new Date(`${form.entry_date}T12:00:00`).toISOString() : new Date().toISOString(),
      exit_date:
        isClosed && form.exit_date
          ? new Date(`${form.exit_date}T12:00:00`).toISOString()
          : isClosed
            ? new Date().toISOString()
            : null,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl px-4 pb-8 sm:px-6">
        <SheetHeader className="text-left">
          <SheetTitle>{trade ? "Edit Trade" : "Add Trade"}</SheetTitle>
          <SheetDescription>
            Quick manual entry. Prices follow the pair&apos;s decimal format
            {form.pair.trim() ? ` (${priceDecimals} dp)` : ""}.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <section className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="pair">Symbol</Label>
              <Input
                id="pair"
                list="supported-trade-pairs"
                placeholder="XAUUSD or EUR/USD"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={Boolean(pairError)}
                aria-describedby={pairError ? "pair-error" : undefined}
                value={form.pair}
                onChange={(event) => {
                  setPairError(null);
                  setPairSuggestion(null);
                  setForm((current) => ({ ...current, pair: event.target.value.toUpperCase() }));
                }}
                onBlur={handlePairBlur}
                className={cn(pairError && "border-destructive focus-visible:ring-destructive")}
              />
              <datalist id="supported-trade-pairs">
                {SUPPORTED_PAIR_SUGGESTIONS.map((symbol) => (
                  <option key={symbol} value={symbol} />
                ))}
              </datalist>
              {pairError ? (
                <div
                  id="pair-error"
                  className="space-y-1.5 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2"
                >
                  <p className="text-xs leading-relaxed text-destructive">{pairError}</p>
                  {pairSuggestion ? (
                    <button
                      type="button"
                      onClick={acceptPairSuggestion}
                      className="text-xs font-semibold text-foreground underline-offset-2 hover:underline"
                    >
                      Use {formatPairTokenForDisplay(pairSuggestion)}
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Full symbols only — e.g. XAUUSD (not XAUUS), EURUSD, BTCUSD.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Direction</Label>
                <Select
                  value={form.direction}
                  onValueChange={(value: DirectionOption) =>
                    setForm((current) => ({ ...current, direction: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="long">Long</SelectItem>
                    <SelectItem value="short">Short</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value: ManualTradeInput["status"]) =>
                    setForm((current) => ({
                      ...current,
                      status: value,
                      exit_date:
                        value === "closed"
                          ? current.exit_date || new Date().toISOString().slice(0, 10)
                          : "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!isClosed ? (
              <p className="text-xs text-muted-foreground">
                Open and cancelled trades show in your list but do not update P&amp;L or the equity chart
                until you close them with a P&amp;L amount.
              </p>
            ) : null}
          </section>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Prices
              </p>
              <p className="text-[11px] text-muted-foreground">
                e.g. {pricePlaceholder}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="entry-price">Entry</Label>
                <Input
                  id="entry-price"
                  inputMode="decimal"
                  step={priceStep}
                  placeholder={pricePlaceholder}
                  value={form.entry_price}
                  onChange={(event) => updatePriceField("entry_price", event.target.value)}
                  onBlur={() => blurPriceField("entry_price")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stop-loss">Stop Loss</Label>
                <Input
                  id="stop-loss"
                  inputMode="decimal"
                  step={priceStep}
                  placeholder={pricePlaceholder}
                  value={form.stop_loss}
                  onChange={(event) => updatePriceField("stop_loss", event.target.value)}
                  onBlur={() => blurPriceField("stop_loss")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="take-profit">Take Profit</Label>
                <Input
                  id="take-profit"
                  inputMode="decimal"
                  step={priceStep}
                  placeholder={pricePlaceholder}
                  value={form.take_profit}
                  onChange={(event) => updatePriceField("take_profit", event.target.value)}
                  onBlur={() => blurPriceField("take_profit")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="position-size">Lots</Label>
                <Input
                  id="position-size"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0.10"
                  value={form.position_size}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      position_size: sanitizePriceInput(event.target.value, 4),
                    }))
                  }
                />
              </div>

              {isClosed ? (
                <div className="space-y-2">
                  <Label htmlFor="exit-price">Exit</Label>
                  <Input
                    id="exit-price"
                    inputMode="decimal"
                    step={priceStep}
                    placeholder={pricePlaceholder}
                    value={form.exit_price}
                    onChange={(event) => updatePriceField("exit_price", event.target.value)}
                    onBlur={() => blurPriceField("exit_price")}
                  />
                </div>
              ) : null}

              {isClosed ? (
                <div className="space-y-2">
                  <Label htmlFor="pnl">P&amp;L *</Label>
                  <Input
                    id="pnl"
                    inputMode="decimal"
                    placeholder="150.00"
                    value={form.pnl}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        pnl: sanitizePriceInput(event.target.value, 2, true),
                      }))
                    }
                    required
                  />
                </div>
              ) : null}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <div className={cn("space-y-2", !isClosed && "col-span-2")}>
              <Label htmlFor="entry-date">Entry Date</Label>
              <Input
                id="entry-date"
                type="date"
                value={form.entry_date}
                onChange={(event) => setForm((current) => ({ ...current, entry_date: event.target.value }))}
              />
            </div>

            {isClosed ? (
              <div className="space-y-2">
                <Label htmlFor="exit-date">Exit Date</Label>
                <Input
                  id="exit-date"
                  type="date"
                  value={form.exit_date}
                  onChange={(event) => setForm((current) => ({ ...current, exit_date: event.target.value }))}
                />
              </div>
            ) : null}
          </section>

          <Collapsible open={showMore} onOpenChange={setShowMore}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-border/50 bg-secondary/30 px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-secondary/50"
              >
                More details
                <ChevronDown
                  className={cn("h-4 w-4 text-muted-foreground transition-transform", showMore && "rotate-180")}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="risk-percent">Risk %</Label>
                  <Input
                    id="risk-percent"
                    inputMode="decimal"
                    placeholder="1"
                    value={form.risk_percent}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        risk_percent: sanitizePriceInput(event.target.value, 2),
                      }))
                    }
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="tags">Tags / Setup</Label>
                  <Input
                    id="tags"
                    placeholder="Breakout, London..."
                    value={form.tags}
                    onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    rows={3}
                    placeholder="What went well?"
                    value={form.notes}
                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <SheetFooter className="mt-6 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={isSaving || !form.pair.trim() || (isClosed && !form.pnl.trim())}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {trade ? "Update Trade" : "Save Trade"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
