// Substitutable tile source — never hardcoded inline at each call site (M8 section 33).
// Default is OpenStreetMap's standard tile server, acceptable for MVP1/low-volume use per
// https://operations.osmfoundation.org/policies/tiles/ (HTTPS, visible attribution, no
// prefetching/bulk download/offline caching — see apps/web/README.md "Map").
const DEFAULT_OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

export function getMapTileUrl(): string {
  return process.env["NEXT_PUBLIC_MAP_TILE_URL"] ?? DEFAULT_OSM_TILE_URL;
}

export function getMapTileAttribution(): string {
  return process.env["NEXT_PUBLIC_MAP_ATTRIBUTION"] ?? DEFAULT_OSM_ATTRIBUTION;
}
