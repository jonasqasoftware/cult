import { createHash } from "node:crypto";

// Sorts object keys recursively before stringifying, so the hash depends only on the
// payload's actual content — never on incidental JSON key order — with no canonical-JSON
// dependency. Shared by every connector (extracted from the Ticketmaster connector in M3
// once a second provider needed the exact same behavior — see M2.1/M3 reports).
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}
