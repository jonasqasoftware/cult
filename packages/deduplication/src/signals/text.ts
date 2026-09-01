const COMBINING_MARKS = /\p{M}/gu;
const NON_WORD = /[^\p{L}\p{N}\s]/gu;
const WHITESPACE = /\s+/g;

// Generic text normalization shared by every text-based signal (title, venue, performer
// names). Never hardcodes any specific word/title from the golden dataset.
export function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(NON_WORD, " ")
    .replace(WHITESPACE, " ")
    .trim();
}

export function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  return normalized.length > 0 ? normalized.split(" ") : [];
}

// Common Portuguese function words carry near-zero identifying signal ("Sarau DE Poesia" vs
// "Oficina DE Cerâmica" share only "de") but would otherwise inflate similarity for
// genuinely unrelated titles. Filtered only for similarity scoring — tokenize() itself stays
// a plain, unopinionated tokenizer.
const STOPWORDS = new Set([
  "a", "as", "o", "os", "de", "da", "do", "das", "dos",
  "e", "em", "na", "no", "nas", "nos", "um", "uma",
]);

function significantTokens(input: string): Set<string> {
  return new Set(tokenize(input).filter((token) => !STOPWORDS.has(token)));
}

// Dice coefficient over token sets, blended with the overlap (Szymkiewicz–Simpson)
// coefficient so a shorter title that is fully contained in a longer one (a common editorial
// prefix/suffix pattern) still scores highly even though Dice alone penalizes the size
// difference.
export function textSimilarity(a: string, b: string): number {
  const tokensA = significantTokens(a);
  const tokensB = significantTokens(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }

  const dice = (2 * intersection) / (tokensA.size + tokensB.size);
  const overlap = intersection / Math.min(tokensA.size, tokensB.size);

  return Math.max(dice, overlap);
}
