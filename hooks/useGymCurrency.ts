"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  formatCurrency,
  getCurrencyCodeFromCountry,
  getCurrencySymbol,
  resolveGymCountry,
} from "@/lib/currency";

export function useGymCurrency() {
  const { data: session } = useSession();

  const countryCode = useMemo(() => {
    const gyms = session?.user?.gyms ?? [];
    const locations = session?.user?.locations ?? [];
    const selectedGymId = session?.user?.selected_gym_id;
    const selectedLocationId = session?.user?.selected_location_id;

    const gym = gyms.find((g) => g.id === selectedGymId) ?? gyms[0];
    const location =
      locations.find((l) => l.id === selectedLocationId) ??
      locations.find((l) => l.gymId === gym?.id);

    return resolveGymCountry(gym?.country, location?.country);
  }, [
    session?.user?.gyms,
    session?.user?.locations,
    session?.user?.selected_gym_id,
    session?.user?.selected_location_id,
  ]);

  const currencyCode = useMemo(
    () => getCurrencyCodeFromCountry(countryCode),
    [countryCode]
  );

  const symbol = useMemo(
    () => getCurrencySymbol(countryCode, currencyCode),
    [countryCode, currencyCode]
  );

  return {
    countryCode,
    currencyCode,
    symbol,
    format: (amount: number) =>
      formatCurrency(amount, { countryCode, currencyCode }),
  };
}
