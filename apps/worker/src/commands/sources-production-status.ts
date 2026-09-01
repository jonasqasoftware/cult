import { evaluateProductionGate } from "@cult/domain";
import { ALL_SOURCE_DEFINITIONS } from "@cult/config";

// M10 section 7 — the single command that answers "which sources may persist live data in
// production, and why not for the rest." Reads only ALL_SOURCE_DEFINITIONS + the pure
// evaluateProductionGate function; never invents an approval that isn't backed by
// commercialUse="allowed" on the source's own registry entry.
function main(): void {
  for (const source of ALL_SOURCE_DEFINITIONS) {
    const decision = evaluateProductionGate(source);
    console.log(source.id);
    console.log(`commercialUse: ${source.commercialUse}`);
    console.log(`production: ${decision.status.toUpperCase()}`);
    if (decision.status === "blocked") {
      console.log(`reason: ${decision.reason}`);
    }
    console.log("");
  }
}

main();
