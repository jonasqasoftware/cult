import type { CanonicalEvent } from "@cult/domain";

function normalizeUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

type UrlBearing = Pick<CanonicalEvent, "ticketUrl" | "canonicalUrl">;

// Exact URL match is a strong corroborating signal (section 24), but only when BOTH sides
// actually publish a comparable URL — missing is "unknown," and two different URLs are just
// "no match," never a penalty ("URLs diferentes não significam necessariamente eventos
// diferentes"). No network access, no redirect following.
export function assessUrl(left: UrlBearing, right: UrlBearing): number | undefined {
  if (left.ticketUrl && right.ticketUrl) {
    return normalizeUrl(left.ticketUrl) === normalizeUrl(right.ticketUrl) ? 1 : 0;
  }
  if (left.canonicalUrl && right.canonicalUrl) {
    return normalizeUrl(left.canonicalUrl) === normalizeUrl(right.canonicalUrl) ? 1 : 0;
  }
  return undefined;
}
