export const RESET_NOTIFICATION_LIFECYCLE = {
  first_reminder_sent: false,
  second_reminder_sent: false,
  notification_sent: false,
} as const;

export function startsNewSubscriptionLifecycle(
  currentEndDate: Date,
  nextEndDate: Date
): boolean {
  const current = new Date(currentEndDate);
  const next = new Date(nextEndDate);

  if (Number.isNaN(current.getTime()) || Number.isNaN(next.getTime())) {
    return false;
  }

  return next.getTime() > current.getTime();
}

export function notificationLifecycleReset(
  currentEndDate: Date,
  nextEndDate: Date
): typeof RESET_NOTIFICATION_LIFECYCLE | Record<string, never> {
  return startsNewSubscriptionLifecycle(currentEndDate, nextEndDate)
    ? RESET_NOTIFICATION_LIFECYCLE
    : {};
}
