// M2 vertical-slice placeholder. CanonicalEvent requires qualityScore/rankingScore, but the
// real Data Quality Score and Ranking algorithms (CLAUDE.md — deterministic, explainable, no
// ML) are a dedicated future milestone. Every normalizer must use these two named constants
// instead of scattering an unexplained magic number across the codebase.
export const PROVISIONAL_QUALITY_SCORE = 0.5;
export const PROVISIONAL_RANKING_SCORE = 0.5;
