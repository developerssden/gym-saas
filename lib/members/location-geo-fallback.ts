export type GeoFields = {
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  country?: string | null;
};

function pickGeo(
  value: string | null | undefined,
  locationValue: string | null | undefined,
  gymValue: string | null | undefined
): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed) return trimmed;
  const fromLocation =
    typeof locationValue === "string" ? locationValue.trim() : "";
  if (fromLocation) return fromLocation;
  const fromGym = typeof gymValue === "string" ? gymValue.trim() : "";
  return fromGym;
}

/**
 * Fills blank city/state/zip/country from Location, then Gym.
 * Street address is never filled from location/gym.
 */
export function resolveMemberGeoFields(
  input: GeoFields,
  location: GeoFields | null | undefined,
  gym: GeoFields | null | undefined
): Required<GeoFields> {
  return {
    city: pickGeo(input.city, location?.city, gym?.city),
    state: pickGeo(input.state, location?.state, gym?.state),
    zip_code: pickGeo(input.zip_code, location?.zip_code, gym?.zip_code),
    country: pickGeo(input.country, location?.country, gym?.country),
  };
}

export function normalizeOptionalString(
  value: unknown
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
