import type { Performer } from "@cult/domain";
import { normalizeText } from "./text.js";

// A performer name on one side "containing" the other (e.g. "Duo Sul" vs "Duo Sul e Banda")
// counts as a match — a companion act billed alongside the same headliner is not evidence of
// a different performer.
function namesMatch(a: string, b: string): boolean {
  const normalizedA = normalizeText(a);
  const normalizedB = normalizeText(b);
  if (normalizedA.length === 0 || normalizedB.length === 0) return false;
  return normalizedA === normalizedB || normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA);
}

// Missing performer data on either side is "unknown," not "no overlap" — undefined lets the
// aggregation step exclude this signal entirely rather than reading it as evidence of
// difference. Sharing a performer alone is deliberately a weak signal (see engine weights) —
// the same act can headline multiple distinct events.
export function performerOverlap(
  left: readonly Performer[],
  right: readonly Performer[],
): number | undefined {
  if (left.length === 0 || right.length === 0) return undefined;

  let matches = 0;
  const rightMatched = new Set<number>();
  for (const leftPerformer of left) {
    const matchIndex = right.findIndex(
      (rightPerformer, index) => !rightMatched.has(index) && namesMatch(leftPerformer.name, rightPerformer.name),
    );
    if (matchIndex !== -1) {
      matches += 1;
      rightMatched.add(matchIndex);
    }
  }

  return (2 * matches) / (left.length + right.length);
}
