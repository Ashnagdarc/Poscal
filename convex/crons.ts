import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "process notification queue",
  { minutes: 1 },
  internal.notificationsNode.processPendingBatch,
  // Each pass claims a bounded batch. A full batch schedules the next pass immediately.
  { limit: 50 },
);

// Keep pulling the free Forex Factory week feed. force skips the short burst gate
// so a quiet app still receives new prints. JSON is the schedule; XML adds the link.
crons.interval(
  "ingest economic calendar",
  { minutes: 10 },
  internal.newsIngest.runIngest,
  { force: true },
);

crons.interval("reconcile Pro payments", { minutes: 1 }, internal.proPayments.reconcileDue, {});

export default crons;
