import type { EventStatus } from "../api/types";

// M7 section 18 / M8 section 40: "scheduled" is the normal case and gets no badge; every
// other status must be surfaced clearly, never hidden.
const STATUS_LABELS: Partial<Record<EventStatus, string>> = {
  cancelled: "Cancelado",
  postponed: "Adiado",
  rescheduled: "Remarcado",
  completed: "Encerrado",
};

export function presentStatusLabel(status: EventStatus): string | null {
  return STATUS_LABELS[status] ?? null;
}
