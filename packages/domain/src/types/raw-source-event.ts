// Provider-independent representation of a collected payload, before validation or
// normalization. `payload` stays `unknown` on purpose: the domain must never model a
// specific provider's payload shape (that belongs to each connector/normalizer).
export interface RawSourceEvent {
  readonly id: string;
  readonly sourceId: string;
  readonly externalId?: string;
  readonly sourceUrl: string;
  readonly payload: unknown;
  readonly contentHash: string;
  readonly fetchedAt: Date;
  readonly schemaVersion: number;
}
