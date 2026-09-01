export interface GeoPoint {
  readonly latitude?: number;
  readonly longitude?: number;
}

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Haversine — pure TypeScript, no dependency. Missing coordinates on either side is
// "unknown," not a conflict — callers must treat `undefined` accordingly.
export function geoDistanceMeters(a: GeoPoint, b: GeoPoint): number | undefined {
  if (a.latitude === undefined || a.longitude === undefined) return undefined;
  if (b.latitude === undefined || b.longitude === undefined) return undefined;

  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);

  const h =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

// Linear decay reaching 0 at 1km — a normalized 0..1 signal, not itself a conflict decision
// (see engine/conflicts.ts for the objective distance threshold used there).
const GEO_SIMILARITY_DECAY_METERS = 1000;

export function geoSimilarity(distanceMeters: number): number {
  return Math.max(0, 1 - distanceMeters / GEO_SIMILARITY_DECAY_METERS);
}
