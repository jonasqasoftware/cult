// `pnpm dedup:dataset:summary` — pure statistics about the golden dataset. No network, no
// database, no matching algorithm. See packages/deduplication/src/golden-dataset/summary.ts.
import { loadGoldenDataset } from "../golden-dataset/loader.js";
import { summarizeGoldenDataset } from "../golden-dataset/summary.js";
import { validateGoldenDataset } from "../golden-dataset/validator.js";

const dataset = loadGoldenDataset();
const validation = validateGoldenDataset(dataset);

if (!validation.valid) {
  console.error("[dedup:dataset:summary] dataset failed validation:");
  for (const error of validation.errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

const summary = summarizeGoldenDataset(dataset);

console.log(`cases: ${summary.cases}\n`);

console.log("truth:");
for (const [key, value] of Object.entries(summary.truth)) {
  console.log(`  ${key}: ${value}`);
}

console.log("\nrouting:");
for (const [key, value] of Object.entries(summary.routing)) {
  console.log(`  ${key}: ${value}`);
}

console.log("\ndifficulty:");
for (const [key, value] of Object.entries(summary.difficulty)) {
  console.log(`  ${key}: ${value}`);
}

console.log("\ntemporal:");
for (const [key, value] of Object.entries(summary.temporalPairs)) {
  console.log(`  ${key}: ${value}`);
}

console.log("\ncritical conflicts:");
for (const [key, value] of Object.entries(summary.criticalConflicts)) {
  console.log(`  ${key}: ${value}`);
}

console.log("\ntags:");
for (const [key, value] of Object.entries(summary.tags).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${key}: ${value}`);
}
