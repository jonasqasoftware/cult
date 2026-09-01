export interface SignalInputs {
  readonly title: number;
  readonly venue?: number;
  readonly temporal: number;
  readonly geo?: number;
  readonly performer?: number;
  readonly url?: number;
}

// Baseline weights — the historical hypothesis from the MVP1 technical specification
// (title 0.40 / venue 0.20 / datetime 0.20 / geo 0.10 / performer 0.10). Treated as a
// starting point, not dogma, per M6 section 28 — see the ADR/README for any calibration
// adjustment made against the calibration partition only.
export const BASELINE_WEIGHTS = {
  title: 0.4,
  venue: 0.2,
  temporal: 0.2,
  geo: 0.1,
  performer: 0.1,
} as const;

// A small, capped nudge for a corroborating exact URL match — not a weighted base component
// (section 24: a differing/missing URL must never subtract from the score).
const URL_MATCH_BONUS = 0.05;

// Missing signals are excluded and the remaining weights renormalized to sum to 1, rather
// than the absent signal being read as a similarity of 0 (section 29) — "unknown" is not
// "different."
export function computeScore(signals: SignalInputs): number {
  const weightedTerms: Array<{ value: number; weight: number }> = [
    { value: signals.title, weight: BASELINE_WEIGHTS.title },
    { value: signals.temporal, weight: BASELINE_WEIGHTS.temporal },
  ];
  if (signals.venue !== undefined) {
    weightedTerms.push({ value: signals.venue, weight: BASELINE_WEIGHTS.venue });
  }
  if (signals.geo !== undefined) {
    weightedTerms.push({ value: signals.geo, weight: BASELINE_WEIGHTS.geo });
  }
  if (signals.performer !== undefined) {
    weightedTerms.push({ value: signals.performer, weight: BASELINE_WEIGHTS.performer });
  }

  const totalWeight = weightedTerms.reduce((sum, term) => sum + term.weight, 0);
  const weightedSum = weightedTerms.reduce((sum, term) => sum + term.value * term.weight, 0);
  const baseScore = weightedSum / totalWeight;

  const boosted = signals.url === 1 ? baseScore + URL_MATCH_BONUS : baseScore;

  return Math.min(1, Math.max(0, boosted));
}
