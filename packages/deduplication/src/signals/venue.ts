import type { Venue } from "@cult/domain";
import { textSimilarity } from "./text.js";

// Name-driven similarity, with a small boost from secondary fields (address, neighborhood)
// when both sides happen to publish them — never a penalty for a field only one side has
// (missing data is "unknown," not evidence of a different venue). Coordinates are handled
// separately by geo.ts; this stays text-only.
const NAME_WEIGHT = 0.8;
const SECONDARY_WEIGHT = 0.2;

export function assessVenueText(left: Venue | undefined, right: Venue | undefined): number | undefined {
  if (!left || !right) return undefined;

  const nameSimilarity = textSimilarity(left.name, right.name);

  const secondarySimilarities: number[] = [];
  if (left.address && right.address) {
    secondarySimilarities.push(textSimilarity(left.address, right.address));
  }
  if (left.neighborhood && right.neighborhood) {
    secondarySimilarities.push(textSimilarity(left.neighborhood, right.neighborhood));
  }

  if (secondarySimilarities.length === 0) {
    return nameSimilarity;
  }

  const secondaryAverage =
    secondarySimilarities.reduce((sum, value) => sum + value, 0) / secondarySimilarities.length;

  return nameSimilarity * NAME_WEIGHT + secondaryAverage * SECONDARY_WEIGHT;
}
