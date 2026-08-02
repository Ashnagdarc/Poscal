import { useEffect, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ACCOUNT_CURRENCIES, useCurrency } from "@/contexts/CurrencyContext";
import { useJournal } from "@/contexts/JournalContext";
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
import { toast } from "sonner";

type Step = "welcome" | "setup";

interface JournalOnboardingProps {
  mode?: "first" | "create";
  onComplete?: () => void;
  onCancel?: () => void;
}

/** Surface server reasons (limit / auth) from Convex-wrapped Error messages. */
function toJournalCreateToastMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const uncaught = raw.match(/Uncaught Error:\s*(.+?)(?:\n|$)/i)?.[1]?.trim();
  const candidate = uncaught || raw;

  if (/not authenticated/i.test(candidate)) {
    return "Please sign in again to create a journal";
  }
  if (/journal limit reached/i.test(candidate)) {
    const match = candidate.match(/Journal limit reached[^.!\n]*/i);
    return match?.[0]?.trim() ?? "Journal limit reached for your plan";
  }
  if (/journal name is required|account size must be/i.test(candidate)) {
    return candidate;
  }
  if (
    candidate
    && !/\[CONVEX|VITE_|API_KEY|Request ID|@convex|\.ts:|\.js:|\n/i.test(candidate)
    && candidate.length <= 160
  ) {
    return candidate;
  }
  if (/unavailable/i.test(raw)) {
    return "Service temporarily unavailable. Please try again.";
  }
  return "Failed to create journal";
}

export const JournalOnboarding = ({
  mode = "first",
  onComplete,
  onCancel,
}: JournalOnboardingProps) => {
  const { user } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const { createJournal } = useJournal();

  const [step, setStep] = useState<Step>(mode === "first" ? "welcome" : "setup");
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [journalName, setJournalName] = useState("");
  const [accountSize, setAccountSize] = useState("10000");
  const [currencyCode, setCurrencyCode] = useState(currency.code);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (step !== "welcome") return;
    const timer = window.setTimeout(() => setStep("setup"), 2400);
    return () => window.clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (user?.full_name) setFullName(user.full_name);
  }, [user?.full_name]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const size = Number(accountSize);
    if (!journalName.trim()) {
      toast.error("Give your journal a name");
      return;
    }
    if (!Number.isFinite(size) || size <= 0) {
      toast.error("Enter a valid account size");
      return;
    }
    if (mode === "first" && !fullName.trim()) {
      toast.error("Enter your full name");
      return;
    }

    setIsSaving(true);
    try {
      const selected = ACCOUNT_CURRENCIES.find((item) => item.code === currencyCode) ?? ACCOUNT_CURRENCIES[0];
      setCurrency(selected);
      await createJournal({
        name: journalName.trim(),
        currency: selected.code,
        startingBalance: size,
        fullName: fullName.trim() || null,
      });
      toast.success(mode === "first" ? "Journal ready" : "Journal created");
      onComplete?.();
    } catch (error) {
      console.error("[journalOnboarding] Failed to create journal", error);
      toast.error(toJournalCreateToastMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-1">
      <AnimatePresence mode="wait">
        {step === "welcome" ? (
          <motion.div
            key="welcome"
            className="flex flex-col items-center justify-center px-4 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
          >
            <motion.p
              className="font-display text-2xl font-semibold leading-snug text-foreground sm:text-3xl"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            >
              Hey Boss, let&apos;s track your trading journey together
            </motion.p>
          </motion.div>
        ) : (
          <motion.form
            key="setup"
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl bg-secondary p-4 sm:p-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {mode === "first" ? "Set up your journal" : "New journal"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Account size and currency power your growth chart and returns.
              </p>
            </div>

            {mode === "first" ? (
              <div className="space-y-2">
                <Label htmlFor="fullName">Your full name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Daniel Samuel"
                  autoComplete="name"
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="journalName">Journal name</Label>
              <Input
                id="journalName"
                value={journalName}
                onChange={(event) => setJournalName(event.target.value)}
                placeholder="Main account"
                autoFocus={mode !== "first"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountSize">Account size</Label>
              <Input
                id="accountSize"
                type="number"
                inputMode="decimal"
                min="1"
                step="any"
                value={accountSize}
                onChange={(event) => setAccountSize(event.target.value)}
                placeholder="10000"
              />
            </div>

            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currencyCode} onValueChange={setCurrencyCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_CURRENCIES.map((item) => (
                    <SelectItem key={item.code} value={item.code}>
                      {item.code} · {item.symbol} · {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-1">
              {mode === "create" && onCancel ? (
                <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={isSaving}>
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" className="flex-1" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : mode === "first" ? (
                  "Start journaling"
                ) : (
                  "Create journal"
                )}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
};
