import { DomainValidationError } from "../errors.js";

export interface Venue {
  readonly id: string;
  readonly name: string;
  readonly address?: string;
  readonly neighborhood?: string;
  readonly city: string;
  readonly state: string;
  readonly country: "BR";
  readonly latitude?: number;
  readonly longitude?: number;
}

export interface CreateVenueInput {
  readonly id: string;
  readonly name: string;
  readonly address?: string;
  readonly neighborhood?: string;
  readonly city: string;
  readonly state: string;
  readonly latitude?: number;
  readonly longitude?: number;
}

// Structural validation only — no geocoding, no address normalization.
export function createVenue(input: CreateVenueInput): Venue {
  const { latitude, longitude } = input;

  if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
    throw new DomainValidationError("Venue: latitude must be between -90 and 90");
  }
  if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
    throw new DomainValidationError("Venue: longitude must be between -180 and 180");
  }

  return {
    id: input.id,
    name: input.name,
    ...(input.address !== undefined ? { address: input.address } : {}),
    ...(input.neighborhood !== undefined ? { neighborhood: input.neighborhood } : {}),
    city: input.city,
    state: input.state,
    country: "BR",
    ...(latitude !== undefined ? { latitude } : {}),
    ...(longitude !== undefined ? { longitude } : {}),
  };
}
