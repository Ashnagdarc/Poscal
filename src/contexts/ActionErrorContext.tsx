import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ActionErrorDialog } from "@/components/ActionErrorDialog";
import { parseActionError, type ActionErrorInfo } from "@/lib/actionError";

type ShowOptions = {
  title?: string;
  fallbackMessage?: string;
  code?: string;
  onRetry?: () => void;
  retryLabel?: string;
};

type ActionErrorContextValue = {
  showError: (error: ActionErrorInfo, options?: Pick<ShowOptions, "onRetry" | "retryLabel">) => void;
  showErrorFromUnknown: (error: unknown, options?: ShowOptions) => void;
  clearError: () => void;
};

const ActionErrorContext = createContext<ActionErrorContextValue | null>(null);

export const ActionErrorProvider = ({ children }: { children: ReactNode }) => {
  const [info, setInfo] = useState<ActionErrorInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [onRetry, setOnRetry] = useState<(() => void) | undefined>();
  const [retryLabel, setRetryLabel] = useState("Try again");

  const clearError = useCallback(() => {
    setOpen(false);
    setOnRetry(undefined);
  }, []);

  const showError = useCallback(
    (error: ActionErrorInfo, options?: Pick<ShowOptions, "onRetry" | "retryLabel">) => {
      setInfo(error);
      setOnRetry(() => options?.onRetry);
      setRetryLabel(options?.retryLabel ?? "Try again");
      setOpen(true);
    },
    [],
  );

  const showErrorFromUnknown = useCallback(
    (error: unknown, options?: ShowOptions) => {
      const parsed = parseActionError(error, {
        title: options?.title,
        fallbackMessage: options?.fallbackMessage,
        code: options?.code,
      });
      showError(parsed, {
        onRetry: options?.onRetry,
        retryLabel: options?.retryLabel,
      });
    },
    [showError],
  );

  const value = useMemo(
    () => ({ showError, showErrorFromUnknown, clearError }),
    [showError, showErrorFromUnknown, clearError],
  );

  return (
    <ActionErrorContext.Provider value={value}>
      {children}
      <ActionErrorDialog
        open={open}
        error={info}
        onClose={clearError}
        onRetry={onRetry}
        retryLabel={retryLabel}
      />
    </ActionErrorContext.Provider>
  );
};

export const useActionError = (): ActionErrorContextValue => {
  const ctx = useContext(ActionErrorContext);
  if (!ctx) {
    throw new Error("useActionError must be used within ActionErrorProvider");
  }
  return ctx;
};
