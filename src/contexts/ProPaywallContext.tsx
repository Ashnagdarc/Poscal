import { createContext, useContext, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ProCheckout } from "@/components/ProCheckout";
const Context = createContext<(feature?: string) => void>(() => {});
export function ProPaywallProvider({ children }: { children: ReactNode }) {
  const [feature, setFeature] = useState<string | null>(null);
  const location = useLocation();
  return (
    <Context.Provider value={(reason = "More with Pro") => setFeature(reason)}>
      {children}
      <Dialog
        open={feature !== null}
        onOpenChange={(open) => {
          if (!open) setFeature(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{feature}</DialogTitle>
            <DialogDescription>
              Keep your data and unlock more room with Poscal Pro.
            </DialogDescription>
          </DialogHeader>
          {feature !== null && (
            <ProCheckout
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
