import { Calculator, PenLine, ArrowRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface LogTradeChoiceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onManual: () => void;
  onAutomatic: () => void;
}

export const LogTradeChoiceSheet = ({
  open,
  onOpenChange,
  onManual,
  onAutomatic,
}: LogTradeChoiceSheetProps) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent
      side="bottom"
      className="rounded-t-3xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:inset-x-0 sm:bottom-auto sm:top-[max(1.25rem,12dvh)] sm:mx-auto sm:w-[min(32rem,calc(100%-2rem))] sm:rounded-2xl sm:border sm:px-6 sm:pb-6 sm:pt-6"
    >
      <SheetHeader className="text-left">
        <SheetTitle>Log a trade</SheetTitle>
        <SheetDescription>
          Choose how you want to create this journal entry. Nothing is pulled from your old calculator history.
        </SheetDescription>
      </SheetHeader>

      <div className="mt-5 space-y-3">
        <button
          type="button"
          onClick={onManual}
          className="flex w-full items-center gap-4 rounded-2xl border border-border bg-secondary p-4 text-left transition hover:bg-secondary/80 active:scale-[0.99]"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-background text-foreground">
            <PenLine className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-foreground">Manual</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              Log only the details you have, then add notes and before/after charts.
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        <button
          type="button"
          onClick={onAutomatic}
          className="flex w-full items-center gap-4 rounded-2xl border border-border bg-secondary p-4 text-left transition hover:bg-secondary/80 active:scale-[0.99]"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-background text-foreground">
            <Calculator className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-foreground">Automatic</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              Start a fresh Poscal calculation and turn only that calculation into a new journal trade.
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </div>
    </SheetContent>
  </Sheet>
);

export default LogTradeChoiceSheet;
