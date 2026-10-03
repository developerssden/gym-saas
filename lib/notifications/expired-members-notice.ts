import { formatCalendarDate } from "@/lib/date-utils";

export const EXPIRED_MEMBERS_NOTICE_TYPE = "member_expired_summary";
export const EXPIRED_MEMBERS_PDF_PATH = "/api/notifications/expired-members-pdf";

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ENTRY_SEPARATOR = ",";
const FIELD_SEPARATOR = "~";

export type ExpiredMemberEntry = {
  subscriptionId: string;
  startDate: string;
  endDate: string;
};

export type ExpiredMembersNotice = {
  date: string;
  entries: ExpiredMemberEntry[];
};

export function buildExpiredMembersPdfUrl(
  referenceDate: Date,
  subscriptions: Array<{ id: string; start_date: Date; end_date: Date }>
): string {
  const entries = subscriptions
    .map((sub) =>
      [
        sub.id,
        formatCalendarDate(sub.start_date),
        formatCalendarDate(sub.end_date),
      ].join(FIELD_SEPARATOR)
    )
    .join(ENTRY_SEPARATOR);

  const params = new URLSearchParams({
    date: formatCalendarDate(referenceDate),
    m: entries,
  });
  return `${EXPIRED_MEMBERS_PDF_PATH}?${params.toString()}`;
}

export function parseExpiredMembersNotice(query: {
  date?: string | string[];
  m?: string | string[];
}): ExpiredMembersNotice | null {
  const date = Array.isArray(query.date) ? query.date[0] : query.date;
  const raw = Array.isArray(query.m) ? query.m[0] : query.m;
  if (!date || !CALENDAR_DATE.test(date) || !raw) return null;

  const entries: ExpiredMemberEntry[] = [];
  for (const part of raw.split(ENTRY_SEPARATOR)) {
    const [subscriptionId, startDate, endDate, ...rest] =
      part.split(FIELD_SEPARATOR);
    if (
      rest.length > 0 ||
      !subscriptionId ||
      !CALENDAR_DATE.test(startDate ?? "") ||
      !CALENDAR_DATE.test(endDate ?? "")
    ) {
      return null;
    }
    entries.push({ subscriptionId, startDate, endDate });
  }

  return entries.length > 0 ? { date, entries } : null;
}

export function isExpiredMembersNotice(notification: {
  type: string;
  url: string | null;
}): boolean {
  return (
    notification.type === EXPIRED_MEMBERS_NOTICE_TYPE &&
    Boolean(notification.url?.startsWith(EXPIRED_MEMBERS_PDF_PATH))
  );
}
