// Read-only, bounded, non-persisting discovery spike — never touches the database. See
// docs/sources/destino-poa.md and packages/connectors/src/destino-poa/destino-poa-inspector.ts.
import { inspectDestinoPOA } from "@cult/connectors";

async function main(): Promise<void> {
  const result = await inspectDestinoPOA();
  console.log(JSON.stringify(result));
}

main().catch((error: unknown) => {
  console.error("[worker] destino-poa inspection failed:", error);
  process.exit(1);
});
