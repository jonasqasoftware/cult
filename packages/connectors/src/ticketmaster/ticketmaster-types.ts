// Minimized Ticketmaster Discovery API v2 DTOs — only the fields the CULT connector reads.
// These types are provider-specific and MUST NOT be imported into packages/domain.

export interface TicketmasterImage {
  readonly url: string;
  readonly ratio?: string;
  readonly width?: number;
  readonly height?: number;
}

export interface TicketmasterDateInfo {
  readonly start?: {
    readonly localDate?: string;
    readonly localTime?: string;
    readonly dateTime?: string;
  };
  readonly status?: {
    readonly code?: string;
  };
}

export interface TicketmasterClassification {
  readonly primary?: boolean;
  readonly segment?: { readonly name?: string };
  readonly genre?: { readonly name?: string };
}

export interface TicketmasterPriceRange {
  readonly type?: string;
  readonly currency?: string;
  readonly min?: number;
  readonly max?: number;
}

export interface TicketmasterVenue {
  readonly id?: string;
  readonly name?: string;
  readonly city?: { readonly name?: string };
  readonly state?: { readonly stateCode?: string };
  readonly country?: { readonly countryCode?: string };
  readonly address?: { readonly line1?: string };
  readonly location?: { readonly latitude?: string; readonly longitude?: string };
}

export interface TicketmasterAttraction {
  readonly id?: string;
  readonly name?: string;
}

export interface TicketmasterEvent {
  readonly id: string;
  readonly name: string;
  readonly url?: string;
  readonly images?: readonly TicketmasterImage[];
  readonly info?: string;
  readonly dates?: TicketmasterDateInfo;
  readonly classifications?: readonly TicketmasterClassification[];
  readonly priceRanges?: readonly TicketmasterPriceRange[];
  readonly _embedded?: {
    readonly venues?: readonly TicketmasterVenue[];
    readonly attractions?: readonly TicketmasterAttraction[];
  };
}

export interface TicketmasterEventSearchResponse {
  readonly _embedded?: {
    readonly events?: readonly TicketmasterEvent[];
  };
  readonly page?: {
    readonly size?: number;
    readonly totalElements?: number;
    readonly totalPages?: number;
    readonly number?: number;
  };
}
