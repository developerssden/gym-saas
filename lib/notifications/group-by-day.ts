// Notifications page: group the list under "Today", "Yesterday" or "22 Nov 2026".
import { format, isSameDay, subDays } from "date-fns";

export type DayGroup<T> = { key: string; label: string; items: T[] };

export function dayLabel(date: Date, now = new Date()): string {
  if (isSameDay(date, now)) return "Today";
  if (isSameDay(date, subDays(now, 1))) return "Yesterday";
  return format(date, "d MMM yyyy");
}

/** Keeps the incoming order (newest first); one group per calendar day. */
export function groupByDay<T extends { createdAt: string | Date }>(items: T[], now = new Date()): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const date = new Date(item.createdAt);
    const key = format(date, "yyyy-MM-dd");
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: dayLabel(date, now), items: [item] });
  }
  return groups;
}
