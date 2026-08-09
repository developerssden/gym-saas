"use client";

import { useGymCurrency } from "@/hooks/useGymCurrency";
import { formatCurrency } from "@/lib/currency";

type CurrencyAmountProps = {
  amount: number;
  /** Override gym/session currency using an explicit country code. */
  countryCode?: string | null;
  className?: string;
};

export function CurrencyAmount({
  amount,
  countryCode,
  className,
}: CurrencyAmountProps) {
  const gymCurrency = useGymCurrency();
  const formatted = countryCode
    ? formatCurrency(amount, { countryCode })
    : gymCurrency.format(amount);

  return <span className={className}>{formatted}</span>;
}
