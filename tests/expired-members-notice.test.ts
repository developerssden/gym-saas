import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExpiredMembersPdfUrl,
  EXPIRED_MEMBERS_NOTICE_TYPE,
  isExpiredMembersNotice,
  parseExpiredMembersNotice,
} from "@/lib/notifications/expired-members-notice";

function queryOf(url: string) {
  const params = new URL(url, "http://localhost").searchParams;
  return { date: params.get("date") ?? undefined, m: params.get("m") ?? undefined };
}

test("PDF link keeps each member's dates from the day of the notice", () => {
  const url = buildExpiredMembersPdfUrl(new Date("2026-10-03T05:00:00Z"), [
    {
      id: "sub-1",
      start_date: new Date("2026-09-03T05:00:00Z"),
      end_date: new Date("2026-10-03T05:00:00Z"),
    },
    {
      id: "sub-2",
      start_date: new Date("2026-08-01T05:00:00Z"),
      end_date: new Date("2026-10-02T05:00:00Z"),
    },
  ]);

  assert.deepEqual(parseExpiredMembersNotice(queryOf(url)), {
    date: "2026-10-03",
    entries: [
      { subscriptionId: "sub-1", startDate: "2026-09-03", endDate: "2026-10-03" },
      { subscriptionId: "sub-2", startDate: "2026-08-01", endDate: "2026-10-02" },
    ],
  });
});

test("dates follow the business time zone, not UTC", () => {
  const url = buildExpiredMembersPdfUrl(new Date("2026-10-02T20:00:00Z"), [
    {
      id: "sub-1",
      start_date: new Date("2026-09-02T20:00:00Z"),
      end_date: new Date("2026-10-02T20:00:00Z"),
    },
  ]);

  assert.deepEqual(parseExpiredMembersNotice(queryOf(url))?.entries[0], {
    subscriptionId: "sub-1",
    startDate: "2026-09-03",
    endDate: "2026-10-03",
  });
});

test("malformed links are rejected", () => {
  assert.equal(parseExpiredMembersNotice({}), null);
  assert.equal(parseExpiredMembersNotice({ date: "2026-10-03" }), null);
  assert.equal(
    parseExpiredMembersNotice({ date: "yesterday", m: "sub-1~2026-09-03~2026-10-03" }),
    null
  );
  assert.equal(
    parseExpiredMembersNotice({ date: "2026-10-03", m: "sub-1~2026-09-03" }),
    null
  );
  assert.equal(
    parseExpiredMembersNotice({ date: "2026-10-03", m: "sub-1~x~2026-10-03~extra" }),
    null
  );
});

test("only expired-member notices pointing at the PDF get a download", () => {
  const url = "/api/notifications/expired-members-pdf?date=2026-10-03&m=a~2026-09-03~2026-10-03";
  assert.equal(isExpiredMembersNotice({ type: EXPIRED_MEMBERS_NOTICE_TYPE, url }), true);
  assert.equal(isExpiredMembersNotice({ type: "announcement", url }), false);
  assert.equal(
    isExpiredMembersNotice({ type: EXPIRED_MEMBERS_NOTICE_TYPE, url: "/dashboard" }),
    false
  );
});
