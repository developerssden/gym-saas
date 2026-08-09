import { countries } from "country-data-list";

export const DEFAULT_CURRENCY = "PKR";
export const DEFAULT_LOCALE = "en-PK";

type CountryRecord = {
  alpha2?: string;
  alpha3?: string;
  currencies?: string[];
};

function findCountry(countryCode?: string | null): CountryRecord | undefined {
  if (!countryCode) return undefined;
  const code = countryCode.trim().toUpperCase();
  if (!code) return undefined;

  const all = countries.all as CountryRecord[];
  return all.find(
    (country) =>
      country.alpha3 === code ||
      country.alpha2 === code ||
      country.alpha2?.toUpperCase() === code ||
      country.alpha3?.toUpperCase() === code
  );
}

/** Resolve ISO 4217 currency code from a country alpha2/alpha3 code. */
export function getCurrencyCodeFromCountry(
  countryCode?: string | null
): string {
  const country = findCountry(countryCode);
  const currency = country?.currencies?.[0]?.trim().toUpperCase();
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    return currency;
  }
  return DEFAULT_CURRENCY;
}

function localeForCurrency(currency: string, countryCode?: string | null): string {
  const country = findCountry(countryCode);
  if (country?.alpha2) {
    return `en-${country.alpha2.toUpperCase()}`;
  }
  if (currency === "PKR") return DEFAULT_LOCALE;
  if (currency === "USD") return "en-US";
  if (currency === "GBP") return "en-GB";
  if (currency === "EUR") return "en-IE";
  return "en";
}

export type FormatCurrencyOptions = {
  countryCode?: string | null;
  currencyCode?: string | null;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
};

/** Format an amount using currency derived from country (or an explicit currency code). */
export function formatCurrency(
  amount: number,
  options: FormatCurrencyOptions = {}
): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const currency =
    options.currencyCode?.trim().toUpperCase() ||
    getCurrencyCodeFromCountry(options.countryCode);

  try {
    return new Intl.NumberFormat(
      localeForCurrency(currency, options.countryCode),
      {
        style: "currency",
        currency,
        maximumFractionDigits: options.maximumFractionDigits ?? 0,
        minimumFractionDigits: options.minimumFractionDigits ?? 0,
      }
    ).format(safe);
  } catch {
    return new Intl.NumberFormat(DEFAULT_LOCALE, {
      style: "currency",
      currency: DEFAULT_CURRENCY,
      maximumFractionDigits: options.maximumFractionDigits ?? 0,
      minimumFractionDigits: options.minimumFractionDigits ?? 0,
    }).format(safe);
  }
}

/** Prefer gym country, then location country as fallback. */
export function resolveGymCountry(
  gymCountry?: string | null,
  locationCountry?: string | null
): string | null {
  const gym = gymCountry?.trim();
  if (gym) return gym;
  const location = locationCountry?.trim();
  if (location) return location;
  return null;
}

export function getCurrencySymbol(
  countryCode?: string | null,
  currencyCode?: string | null
): string {
  const formatted = formatCurrency(0, { countryCode, currencyCode });
  const symbol = formatted.replace(/[\d\s.,]/g, "").trim();
  return symbol || getCurrencyCodeFromCountry(countryCode);
}
