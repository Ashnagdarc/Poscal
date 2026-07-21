import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import type { JournalTrade } from "@/lib/convexJournal";
import type { ManualTradeInput } from "@/hooks/queries/use-trades-query";

interface ManualTradeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade?: JournalTrade | null;
  isSaving?: boolean;
  onSave: (trade: ManualTradeInput) => Promise<void>;
}

const parseOptionalNumber = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toInputDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const emptyForm = (): ManualTradeInput => ({
  pair: "",
  direction: "long",
  entry_price: null,
  exit_price: null,
  stop_loss: null,
  take_profit: null,
  position_size: null,
  risk_percent: null,
  pnl: null,
  status: "open",
  notes: null,
  entry_date: new Date().toISOString().slice(0, 10),
  exit_date: null,
  tags: null,
  market_condition: null,
});

export const ManualTradeSheet = ({
  open,
  onOpenChange,
  trade,
  isSaving = false,
  onSave,
}: ManualTradeSheetProps) => {
  const [form, setForm] = useState<ManualTradeInput>(emptyForm);

  useEffect(() => {
    if (!open) return;

    if (trade) {
      setForm({
        pair: trade.pair,
        direction: trade.direction,
        entry_price: trade.entry_price,
        exit_price: trade.exit_price,
        stop_loss: trade.stop_loss,
        take_profit: trade.take_profit,
        position_size: trade.position_size,
        risk_percent: trade.risk_percent,
        pnl: trade.pnl,
        status: trade.status,
        notes: trade.notes,
        entry_date: toInputDate(trade.entry_date),
        exit_date: toInputDate(trade.exit_date),
        tags: trade.tags,
        market_condition: trade.market_condition,
      });
      return;
    }

    setForm(emptyForm());
  }, [open, trade]);

  const handleSubmit = async () => {
    const pair = form.pair.trim().toUpperCase();
    if (!pair) return;

    await onSave({
      ...form,
      pair,
      notes: form.notes?.trim() || null,
      tags: form.tags?.trim() || null,
      market_condition: form.market_condition?.trim() || null,
      entry_date: form.entry_date ? new Date(form.entry_date).toISOString() : new Date().toISOString(),
      exit_date:
        form.status === "closed" && form.exit_date
          ? new Date(form.exit_date).toISOString()
          : form.status === "closed"
            ? new Date().toISOString()
            : null,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl px-4 pb-8 sm:px-6">
        <SheetHeader className="text-left">
          <SheetTitle>{trade ? "Edit Trade" : "Add Manual Trade"}</SheetTitle>
          <SheetDescription>
            Log a trade manually — similar to Tradelizer&apos;s manual entry flow.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="pair">Symbol / Pair</Label>
              <Input
                id="pair"
                placeholder="EURUSD or EUR/USD"
                value={form.pair}
                onChange={(event) => setForm((current) => ({ ...current, pair: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Direction</Label>
              <Select
                value={form.direction}
                onValueChange={(value: ManualTradeInput["direction"]) =>
                  setForm((current) => ({ ...current, direction: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="buy">Buy</SelectItem>
                  <SelectItem value="sell">Sell</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value: ManualTradeInput["status"]) =>
                  setForm((current) => ({ ...current, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="entry-date">Entry Date</Label>
              <Input
                id="entry-date"
                type="date"
                value={form.entry_date ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, entry_date: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="exit-date">Exit Date</Label>
              <Input
                id="exit-date"
                type="date"
                disabled={form.status !== "closed"}
                value={form.exit_date ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, exit_date: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entry-price">Entry Price</Label>
              <Input
                id="entry-price"
                inputMode="decimal"
                placeholder="1.0850"
                value={form.entry_price ?? ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, entry_price: parseOptionalNumber(event.target.value) }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="exit-price">Exit Price</Label>
              <Input
                id="exit-price"
                inputMode="decimal"
                placeholder="1.0900"
                value={form.exit_price ?? ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, exit_price: parseOptionalNumber(event.target.value) }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stop-loss">Stop Loss</Label>
              <Input
                id="stop-loss"
                inputMode="decimal"
                value={form.stop_loss ?? ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, stop_loss: parseOptionalNumber(event.target.value) }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="take-profit">Take Profit</Label>
              <Input
                id="take-profit"
                inputMode="decimal"
                value={form.take_profit ?? ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, take_profit: parseOptionalNumber(event.target.value) }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="position-size">Position Size</Label>
              <Input
                id="position-size"
                inputMode="decimal"
                value={form.position_size ?? ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, position_size: parseOptionalNumber(event.target.value) }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="risk-percent">Risk %</Label>
              <Input
                id="risk-percent"
                inputMode="decimal"
                value={form.risk_percent ?? ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, risk_percent: parseOptionalNumber(event.target.value) }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pnl">P&amp;L</Label>
              <Input
                id="pnl"
                inputMode="decimal"
                placeholder="150.00"
                value={form.pnl ?? ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, pnl: parseOptionalNumber(event.target.value) }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="market-condition">Market Condition</Label>
              <Input
                id="market-condition"
                placeholder="Trending, ranging..."
                value={form.market_condition ?? ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, market_condition: event.target.value }))
                }
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="tags">Tags / Setup</Label>
              <Input
                id="tags"
                placeholder="Breakout, London session..."
                value={form.tags ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                placeholder="What went well? What would you change?"
                value={form.notes ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>
          </div>
        </div>

        <SheetFooter className="mt-6 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={isSaving || !form.pair.trim()}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {trade ? "Update Trade" : "Save Trade"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
