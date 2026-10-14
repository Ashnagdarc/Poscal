import { createContext, useContext, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProCheckout } from "@/components/ProCheckout";
const Context = createContext<(feature?: string) => void>(() => {});
export function ProPaywallProvider({ children }: { children: ReactNode }) {
  const [feature, setFeature] = useState<string | null>(null);
  const location = useLocation();
  return (
    <Context.Provider value={(reason = "Poscal Pro") => setFeature(reason)}>
      {children}
      <Dialog
        open={feature !== null}
        onOpenChange={(open) => {
          if (!open) setFeature(null);
        }}
      >
        <DialogContent className="max-h-[92dvh] max-w-md gap-0 overflow-y-auto rounded-3xl border bg-background p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>{feature ?? "Poscal Pro"}</DialogTitle>
            <DialogDescription>Choose a Poscal Pro plan.</DialogDescription>
          </DialogHeader>
          {feature !== null && (
            <ProCheckout
              presentation="sheet"
              returnTo={`${location.pathname}${location.search}`}
              onCheckoutOpen={() => setFeature(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Context.Provider>
  );
}
export const useProPaywall = () => useContext(Context);
