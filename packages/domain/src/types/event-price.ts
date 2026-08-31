// Publisher-reported price information only. CULT does not process payments in the MVP,
// so this is not a monetary/ledger type and must not gain rounding or currency-math behavior.
export interface EventPrice {
  readonly free: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly currency: "BRL";
}
