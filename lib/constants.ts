export const REMINDER_DAYS = {
  FIRST: 2,
  SECOND: 1,
} as const;

export const CASH_PAYMENT_PREFIX = "CASH";

export const SMTP = {
  PORT: 587,
  CONNECTION_TIMEOUT: 100_000,
  GREETING_TIMEOUT: 100_000,
} as const;

export const DASHBOARD = {
  SUBSCRIPTION_TABLE_LIMIT: 25,
  CHART_MONTHS: 12,
} as const;
