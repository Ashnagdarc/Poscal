export type EconomicEventWrite = "patch" | "insert";

/** Stored rows are patched. New rows are inserted. Omitted weeks are not deleted. */
export function economicEventWrite(alreadyStored: boolean): EconomicEventWrite {
  if (alreadyStored) return "patch";
  return "insert";
}

/** External ids already stored and absent from this ingest batch stay as they are. */
export function externalIdsKept(
  storedExternalIds: readonly string[],
  incomingExternalIds: readonly string[],
): string[] {
  const incoming = new Set(incomingExternalIds);
  return storedExternalIds.filter((id) => !incoming.has(id));
}
