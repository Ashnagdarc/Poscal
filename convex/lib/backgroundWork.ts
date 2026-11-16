const TRUTHY_VALUES = new Set(["1", "true", "yes", "on"]);

/**
 * Emergency load-shedding switch for work that may safely wait while the
 * backend protects interactive auth, journal reads, and trade writes.
 *
 * Queues and backfill cursors stay in Convex. Turning the switch off resumes
 * work from the persisted state instead of dropping user data.
 */
export function isOptionalBackgroundWorkPaused(
  value = process.env.POSCAL_OPTIONAL_BACKGROUND_WORK_PAUSED,
): boolean {
  return value != null && TRUTHY_VALUES.has(value.trim().toLowerCase());
}
