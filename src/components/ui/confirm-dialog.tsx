import { ReactNode } from "react";
import { X } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  children?: ReactNode;
}

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  children,
}: ConfirmDialogProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-background/80 p-6 backdrop-blur-sm animate-fade-in sm:items-center">
      <div className="my-auto w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lg animate-scale-in">
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <p className="mb-4 text-muted-foreground">{description}</p>
        
        {children}
        
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="h-12 flex-1 rounded-xl bg-secondary font-semibold text-foreground transition-all duration-200 active:scale-[0.98]"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`h-12 flex-1 rounded-xl font-semibold transition-all duration-200 active:scale-[0.98] ${
              variant === "destructive"
                ? "bg-destructive text-destructive-foreground"
                : "bg-foreground text-background"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
