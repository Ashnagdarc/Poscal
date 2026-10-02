import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "process notification queue",
  { minutes: 1 },
  internal.notificationsNode.processPendingBatch,
  { limit: 50 },
);

// Capture ff_calendar_thisweek.json several times a day, before the feed rolls
// to the next week. The action is one JSON fetch plus an upsert.
crons.interval(
  "ingest economic calendar",
  { hours: 6 },
  internal.newsIngest.runIngest,
  {},
);

export default crons;
