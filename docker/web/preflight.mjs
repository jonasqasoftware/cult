// M10 section 8/10 — fail closed BEFORE the server ever starts accepting connections.
// instrumentation.ts (apps/web/instrumentation.ts) runs the same assertProductionConfig()
// check, but relying on it alone was verified (by actually running this image) to be
// insufficient inside Next's standalone server: a thrown instrumentation-hook error is
// logged and left as an unhandled rejection, but the Node process does NOT exit — it keeps
// listening and answers every request (including /api/health) with a 500 instead of ever
// exiting non-zero. This preflight is the actual fail-closed gate: run as a separate step
// before `node apps/web/server.js` in the container CMD, so an invalid production config
// stops the container from starting at all.
import { assertProductionConfig } from "@cult/config";

assertProductionConfig();
