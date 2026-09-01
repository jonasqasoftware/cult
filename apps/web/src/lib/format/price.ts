import type { CultEvent } from "../api/types";

type PriceFields = Pick<CultEvent, "free" | "price_min" | "price_max" | "currency">;

// M7 section 41 / M8: unknown price is genuinely unknown — never rendered as "Grátis", and
// never as "R$ 0". Returns null when there is nothing honest to show; callers omit the block
// entirely rather than print a placeholder like "Preço não informado".
export function formatPrice(event: PriceFields): string | null {
  if (event.free === true) return "Grátis";

  if (event.price_min == null && event.price_max == null) return null;

  const currency = event.currency ?? "BRL";
  const format = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);

  if (event.price_min != null && event.price_max != null && event.price_min !== event.price_max) {
    return `${format(event.price_min)} – ${format(event.price_max)}`;
  }

  const value = event.price_min ?? event.price_max;
  return value != null ? format(value) : null;
}
