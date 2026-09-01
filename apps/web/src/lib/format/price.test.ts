import { describe, expect, it } from "vitest";
import { formatPrice } from "./price.js";

describe("formatPrice", () => {
  it("shows 'Grátis' when free is explicitly true, regardless of any price fields", () => {
    expect(formatPrice({ free: true, price_min: null, price_max: null, currency: null })).toBe("Grátis");
  });

  it("formats a single known price in BRL", () => {
    expect(formatPrice({ free: false, price_min: 50, price_max: 50, currency: "BRL" })).toBe(
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(50),
    );
  });

  it("formats a price range in BRL", () => {
    const result = formatPrice({ free: false, price_min: 40, price_max: 120, currency: "BRL" });
    expect(result).toContain("–");
    expect(result).toContain(new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(40));
    expect(result).toContain(new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(120));
  });

  it("returns null (never 'Grátis', never 'R$ 0') when the price is genuinely unknown", () => {
    expect(formatPrice({ free: null, price_min: null, price_max: null, currency: null })).toBeNull();
  });

  it("returns null when free is explicitly false but no price figures are known", () => {
    expect(formatPrice({ free: false, price_min: null, price_max: null, currency: null })).toBeNull();
  });
});
