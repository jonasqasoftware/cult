export type EventStatus = "scheduled" | "cancelled" | "postponed" | "rescheduled" | "completed";

export const EVENT_STATUSES: readonly EventStatus[] = [
  "scheduled",
  "cancelled",
  "postponed",
  "rescheduled",
  "completed",
];
