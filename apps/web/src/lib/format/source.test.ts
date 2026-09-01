import { describe, expect, it } from "vitest";
import { presentSourceLabel } from "./source.js";

describe("presentSourceLabel", () => {
  it("translates every currently known source id to a human-readable label", () => {
    expect(presentSourceLabel("ticketmaster")).toBe("Ticketmaster");
    expect(presentSourceLabel("destino-poa")).toBe("Destino POA");
    expect(presentSourceLabel("manual-beta")).toBe("Curadoria CULT");
    expect(presentSourceLabel("ui-demo")).toBe("Conteúdo demonstrativo CULT");
  });

  it('never mislabels ui-demo as real CULT curation — it is fictional, development/demo-only content', () => {
    const label = presentSourceLabel("ui-demo");
    expect(label).not.toBe("CULT");
    expect(label).not.toBe("Curadoria CULT");
    expect(label).not.toBe("Fonte oficial CULT");
  });

  it("falls back to the raw id itself for an unknown source, never inventing a name", () => {
    expect(presentSourceLabel("future-source")).toBe("future-source");
  });
});
