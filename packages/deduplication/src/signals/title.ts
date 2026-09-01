import { textSimilarity } from "./text.js";

// Baseline per section 12: normalized token similarity (Dice/overlap), no edit-distance.
// Kept as its own module (rather than calling textSimilarity directly from the engine) so
// title-specific refinements (should calibration ever show a need for them) have a home
// without changing the generic text utility every other signal also depends on.
export function titleSimilarity(left: string, right: string): number {
  return textSimilarity(left, right);
}
