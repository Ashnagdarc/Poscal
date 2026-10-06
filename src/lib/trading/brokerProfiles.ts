import { resolveInstrumentSymbol, type InstrumentSpecSource } from "@/lib/instrumentSpecs";
import type { InstrumentSpecOverride } from "@/lib/trading/instrumentResolver";

export type BrokerSymbolProfile = {
  symbol: string;
  contractSize?: number;
  minLot?: number;
  lotStep?: number;
  digits?: number;
};

export type BrokerProfile = {
  name: string;
  platform: string;
  servers: string[];
  symbols: Record<string, BrokerSymbolProfile>;
};

export type BrokerProfileSnapshot = {
  source: {
    name: string;
    license: string;
    url: string;
    snapshotCommit: string;
    snapshotDate: string;
    note: string;
  };
  brokers: Record<string, BrokerProfile>;
};

export type BrokerProfileResolution = {
  brokerSlug: string;
  brokerName: string;
  platform: string;
  brokerSymbol: string | null;
  profile: BrokerSymbolProfile | null;
  override: InstrumentSpecOverride | null;
  hasSizingData: boolean;
};

let snapshotPromise: Promise<BrokerProfileSnapshot> | null = null;

const positive = (value: number | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

export const loadBrokerProfileSnapshot = async (): Promise<BrokerProfileSnapshot> => {
  if (!snapshotPromise) {
    snapshotPromise = fetch("/broker-profiles.json", { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Broker profile data failed to load (${response.status})`);
        }
        return await response.json() as BrokerProfileSnapshot;
      })
      .catch((error) => {
        snapshotPromise = null;
        throw error;
      });
  }
  return snapshotPromise;
};

export const listBrokerProfiles = (snapshot: BrokerProfileSnapshot) =>
  Object.entries(snapshot.brokers)
    .map(([slug, broker]) => ({ slug, ...broker }))
    .sort((a, b) => a.name.localeCompare(b.name));

export const resolveBrokerProfile = (
  snapshot: BrokerProfileSnapshot | null | undefined,
  brokerSlug: string | null | undefined,
  symbol: string,
): BrokerProfileResolution | null => {
  if (!snapshot || !brokerSlug) return null;
  const broker = snapshot.brokers[brokerSlug];
  if (!broker) return null;

  const canonical = resolveInstrumentSymbol(symbol);
  const profile = broker.symbols[canonical] ?? null;
  if (!profile) {
    return {
      brokerSlug,
      brokerName: broker.name,
      platform: broker.platform,
      brokerSymbol: null,
      profile: null,
      override: null,
      hasSizingData: false,
    };
  }

  const override: InstrumentSpecOverride = {
    source: "broker-profile" as InstrumentSpecSource,
    warning:
      `Using measured ${broker.name} MetaTrader profile data from ${snapshot.source.snapshotDate}. ` +
      "This is a snapshot, not live account verification.",
  };

  let hasSizingData = false;
  if (positive(profile.contractSize)) {
    override.contractSize = profile.contractSize;
    hasSizingData = true;
  }
  if (positive(profile.minLot)) {
    override.minLot = profile.minLot;
    hasSizingData = true;
  }
  if (positive(profile.lotStep)) {
    override.lotStep = profile.lotStep;
    hasSizingData = true;
  }

  return {
    brokerSlug,
    brokerName: broker.name,
    platform: broker.platform,
    brokerSymbol: profile.symbol ?? null,
    profile,
    override: hasSizingData ? override : null,
    hasSizingData,
  };
};

export const brokerProfileStorageKey = (
  userId?: string | null,
  journalId?: string | null,
) => `poscal.brokerProfile.${userId || "guest"}.${journalId || "default"}`;

export const readStoredBrokerProfile = (
  userId?: string | null,
  journalId?: string | null,
): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(brokerProfileStorageKey(userId, journalId));
  } catch {
    return null;
  }
};

export const writeStoredBrokerProfile = (
  slug: string | null,
  userId?: string | null,
  journalId?: string | null,
) => {
  if (typeof window === "undefined") return;
  const key = brokerProfileStorageKey(userId, journalId);
  if (!slug) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, slug);
};
