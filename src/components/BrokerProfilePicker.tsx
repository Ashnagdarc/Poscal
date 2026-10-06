import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";

import {
  listBrokerProfiles,
  type BrokerProfileSnapshot,
} from "@/lib/trading/brokerProfiles";

type BrokerProfilePickerProps = {
  open: boolean;
  snapshot: BrokerProfileSnapshot | null;
  selectedSlug: string | null;
  isLoading: boolean;
  error: string | null;
  onSelect: (slug: string | null) => void;
  onClose: () => void;
};

export const BrokerProfilePicker = ({
  open,
  snapshot,
  selectedSlug,
  isLoading,
  error,
  onSelect,
  onClose,
}: BrokerProfilePickerProps) => {
  const [query, setQuery] = useState("");

  const brokers = useMemo(() => {
    if (!snapshot) return [];
    const normalized = query.trim().toLowerCase();
    return listBrokerProfiles(snapshot).filter((broker) => {
      if (!normalized) return true;
      return [
        broker.name,
        broker.platform,
        ...(broker.servers ?? []),
      ].some((value) => value.toLowerCase().includes(normalized));
    });
  }, [query, snapshot]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 pb-4 pt-12">
        <div>
          <h2 className="text-xl font-bold text-foreground">Broker profile</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Improves contract size and volume rules where measured data is available.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground"
          aria-label="Close broker picker"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="border-b border-border px-6 py-4">
        <div className="flex h-11 items-center gap-3 rounded-xl bg-secondary px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search broker or server"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            onClose();
          }}
          className="mb-2 flex w-full items-center justify-between rounded-2xl bg-secondary px-4 py-4 text-left"
        >
          <div>
            <p className="font-semibold text-foreground">Poscal Standard</p>
            <p className="mt-1 text-xs text-muted-foreground">No broker profile selected</p>
          </div>
          {!selectedSlug ? <Check className="h-5 w-5 text-brand" /> : null}
        </button>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading broker profiles…</p>
        ) : error ? (
          <p className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">{error}</p>
        ) : (
          <div className="space-y-2">
            {brokers.map((broker) => (
              <button
                key={broker.slug}
                type="button"
                onClick={() => {
                  onSelect(broker.slug);
                  onClose();
                }}
                className="flex w-full items-center justify-between rounded-2xl bg-secondary px-4 py-4 text-left"
              >
                <div className="min-w-0 pr-4">
                  <p className="truncate font-semibold text-foreground">{broker.name}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {broker.platform}
                    {broker.servers?.[0] ? ` · ${broker.servers[0]}` : ""}
                  </p>
                </div>
                {selectedSlug === broker.slug ? <Check className="h-5 w-5 shrink-0 text-brand" /> : null}
              </button>
            ))}
            {!brokers.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No broker matches that search.</p>
            ) : null}
          </div>
        )}
      </div>

      {snapshot ? (
        <footer className="border-t border-border px-6 py-4 text-xs leading-relaxed text-muted-foreground">
          Broker profiles use{" "}
          <a
            href={snapshot.source.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground underline underline-offset-2"
          >
            MetaTrader Broker Symbols
          </a>
          {" "}data ({snapshot.source.license}), adapted for Poscal. Snapshot {snapshot.source.snapshotDate}.
          This is not live broker verification.
        </footer>
      ) : null}
    </div>
  );
};
