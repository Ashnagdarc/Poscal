import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "process notification queue",
  { minutes: 1 },
  internal.notificationsNode.processPendingBatch,
  // Each pass claims a bounded batch. A full batch schedules another pass after a short gap.
  { limit: 20 },
);

// Keep pulling the free Forex Factory week feed. force skips the short burst gate
// so a quiet app still receives new prints. JSON is the schedule; XML adds the link.
crons.interval(
  "ingest economic calendar",
  { minutes: 10 },
  internal.newsIngest.runIngest,
  { force: true },
);

// Session opens are on the UTC hour; a 1-minute tick keeps the 5-minute grace window.
crons.interval(
  "trading session open alerts",
  { minutes: 1 },
  internal.tradingSessionNotifications.enqueueDueSessionAlert,
  {},
);

// Journal log reminders are timezone-local (20:00). Scan devices every 15 minutes.
crons.interval(
  "journal log reminders",
  { minutes: 15 },
  internal.tradingSessionNotifications.enqueueDueJournalLogReminders,
  {},
);

crons.interval("reconcile Pro payments", { minutes: 1 }, internal.proPayments.reconcileDue, {});

crons.interval(
  "charge due Pro auto-renewals",
  { minutes: 15 },
  internal.proPayments.runAutoRenewDue,
  {},
);

export default crons;
