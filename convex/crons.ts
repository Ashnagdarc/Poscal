import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "process notification queue",
  { minutes: 1 },
  internal.notificationsNode.processPendingBatch,
  { limit: 50 },
);

export default crons;
