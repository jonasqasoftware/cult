// Opaque keyset-pagination cursor (CLAUDE.md: cursor pagination, never deep offset; section
// 26: opaque, never exposing SQL internals). Two shapes exist because the two supported
// orderings (section 21) carry different keys — a "nearby" cursor also needs the distance the
// previous page ended on, a "default" cursor doesn't. `mode` lets decode() reject a cursor
// built for the other ordering instead of silently misinterpreting its fields.
export interface DefaultCursor {
  readonly mode: "default";
  readonly sortInstant: string; // ISO instant of the event's next relevant occurrence
  readonly id: string;
}

export interface NearbyCursor {
  readonly mode: "nearby";
  readonly distanceMeters: number;
  readonly sortInstant: string;
  readonly id: string;
}

export type Cursor = DefaultCursor | NearbyCursor;

export type DecodeCursorResult<T extends Cursor> = { readonly ok: true; readonly value: T } | { readonly ok: false };

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor<M extends Cursor["mode"]>(
  encoded: string,
  expectedMode: M,
): DecodeCursorResult<Extract<Cursor, { mode: M }>> {
  let decoded: unknown;
  try {
    const json = Buffer.from(encoded, "base64url").toString("utf8");
    decoded = JSON.parse(json);
  } catch {
    return { ok: false };
  }

  if (!isCursorShape(decoded) || decoded.mode !== expectedMode) {
    return { ok: false };
  }

  return { ok: true, value: decoded as Extract<Cursor, { mode: M }> };
}

function isCursorShape(value: unknown): value is Cursor {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record["sortInstant"] !== "string" || typeof record["id"] !== "string") return false;
  if (record["mode"] === "default") return true;
  if (record["mode"] === "nearby") return typeof record["distanceMeters"] === "number";
  return false;
}
