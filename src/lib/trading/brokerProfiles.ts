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

  // Quote digits are descriptive broker metadata, not sizing economics.
  // Do not infer tickSize or pipSize from digits alone.
  const hasPrecisionData =
    Number.isInteger(profile.digits) && profile.digits! >= 0 && profile.digits! <= 12;
  if (hasPrecisionData) override.quoteDigits = profile.digits;

  return {
    brokerSlug,
    brokerName: broker.name,
    platform: broker.platform,
    brokerSymbol: profile.symbol ?? null,
    profile,
    override: hasSizingData || hasPrecisionData ? override : null,
    hasSizingData,
  };
};

export type AutomaticBrokerResolution = {
  symbol: string;
  snapshotDate: string;
  candidateCount: number;
  selectedProfiles: Array<{
    brokerSlug: string;
    brokerName: string;
    platform: string;
    brokerSymbol: string;
  }>;
  override: InstrumentSpecOverride | null;
  hasSizingData: boolean;
};

/**
 * Automatically choose the strongest broker specification for an instrument.
 *
 * The current snapshot has one source-level snapshotDate rather than per-broker
 * update timestamps, so we do not pretend one broker is "fresher" than another.
 * Instead we reject incomplete records, group complete records by measured
 * contractSize/minLot/lotStep, pick the largest agreement group, and use up to
 * five deterministic profiles from that consensus. When a newer snapshot is
 * deployed this is recalculated automatically.
 */
export const resolveAutomaticBrokerProfile = (
  snapshot: BrokerProfileSnapshot | null | undefined,
  symbol: string,
  maxProfiles = 5,
): AutomaticBrokerResolution | null => {
  if (!snapshot) return null;

  const canonical = resolveInstrumentSymbol(symbol);
  const candidates = Object.entries(snapshot.brokers)
    .map(([brokerSlug, broker]) => {
      const profile = broker.symbols[canonical] ?? null;
      if (
        !profile
        || !positive(profile.contractSize)
        || !positive(profile.minLot)
        || !positive(profile.lotStep)
      ) {
        return null;
      }

      return {
        brokerSlug,
        brokerName: broker.name,
        platform: broker.platform,
        brokerSymbol: profile.symbol,
        profile,
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);

  if (candidates.length === 0) {
    return {
      symbol: canonical,
      snapshotDate: snapshot.source.snapshotDate,
      candidateCount: 0,
      selectedProfiles: [],
      override: null,
      hasSizingData: false,
    };
  }

  const groups = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    const key = [
      candidate.profile.contractSize,
      candidate.profile.minLot,
      candidate.profile.lotStep,
    ].join("|");
    const group = groups.get(key) ?? [];
    group.push(candidate);
    groups.set(key, group);
  }

  const consensus = [...groups.entries()]
    .sort(([keyA, groupA], [keyB, groupB]) => {
      if (groupA.length !== groupB.length) return groupB.length - groupA.length;
      return keyA.localeCompare(keyB);
    })[0]?.[1] ?? [];

  const selected = [...consensus]
    .sort((a, b) => {
      const byName = a.brokerName.localeCompare(b.brokerName);
      return byName !== 0 ? byName : a.brokerSlug.localeCompare(b.brokerSlug);
    })
    .slice(0, Math.max(1, maxProfiles));

  const representative = selected[0]?.profile;
  if (!representative) {
    return {
      symbol: canonical,
      snapshotDate: snapshot.source.snapshotDate,
      candidateCount: candidates.length,
      selectedProfiles: [],
      override: null,
      hasSizingData: false,
    };
  }

  const override: InstrumentSpecOverride = {
    source: "broker-profile" as InstrumentSpecSource,
    contractSize: representative.contractSize,
    minLot: representative.minLot,
    lotStep: representative.lotStep,
    warning:
      `Using automatic broker consensus from ${selected.length} measured profile${selected.length === 1 ? "" : "s"} ` +
      `in the ${snapshot.source.snapshotDate} snapshot. Live MT5/cTrader verification is not connected yet.`,
  };

  return {
    symbol: canonical,
    snapshotDate: snapshot.source.snapshotDate,
    candidateCount: candidates.length,
    selectedProfiles: selected.map((candidate) => ({
      brokerSlug: candidate.brokerSlug,
      brokerName: candidate.brokerName,
      platform: candidate.platform,
      brokerSymbol: candidate.brokerSymbol,
    })),
    override,
    hasSizingData: true,
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
