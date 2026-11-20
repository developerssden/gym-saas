import assert from "node:assert/strict";
import test from "node:test";
import { computeMemberActions } from "@/lib/cron/computeActions";
import {
  addDueSoonReminder,
  reminderFlagIds,
  sortDueSoonMembers,
  type OwnerDueSoonDigest,
} from "@/lib/cron/member-due-reminders";
import { getGymOwnerDueSoonEmail } from "@/lib/email/subscription-emails";

const referenceDate = new Date("2026-07-18T00:00:00.000Z");

function subscription(overrides: {
  id: string;
  end_date: string;
  first_name?: string;
  ownerId?: string;
  ownerEmail?: string | null;
  gymName?: string;
  first_reminder_sent?: boolean;
  second_reminder_sent?: boolean;
  notification_sent?: boolean;
}) {
  return {
    id: overrides.id,
    price: 3000,
    billing_model: "MONTHLY",
    end_date: new Date(overrides.end_date),
    notification_sent: overrides.notification_sent ?? false,
    first_reminder_sent: overrides.first_reminder_sent ?? false,
    second_reminder_sent: overrides.second_reminder_sent ?? false,
    member: {
      user: {
        email: null,
        first_name: overrides.first_name ?? "Ali",
        last_name: "Raza",
        phone_number: "03001234567",
      },
      gym: {
        name: overrides.gymName ?? "Iron Zone Gym",
        country: "PK",
        owner: {
          id: overrides.ownerId ?? "owner-1",
          email: overrides.ownerEmail === undefined ? "owner@example.com" : overrides.ownerEmail,
          first_name: "Bakar",
          last_name: null,
        },
      },
    },
  };
}

function collect(subs: ReturnType<typeof subscription>[]) {
  const digests = new Map<string, OwnerDueSoonDigest>();
  for (const sub of subs) {
    const [action] = computeMemberActions([sub], referenceDate);
    addDueSoonReminder(digests, sub, action);
  }
  return digests;
}

test("members due in 1–2 days are grouped into one digest per owner", () => {
  const digests = collect([
    subscription({ id: "a", end_date: "2026-07-20T00:00:00.000Z", first_name: "Ali" }),
    subscription({ id: "b", end_date: "2026-07-19T00:00:00.000Z", first_name: "Hamza" }),
    subscription({ id: "c", end_date: "2026-07-20T00:00:00.000Z", ownerId: "owner-2" }),
  ]);

  assert.equal(digests.size, 2);
  const first = digests.get("owner-1")!;
  assert.equal(first.ownerEmail, "owner@example.com");
  assert.deepEqual(
    first.members.map((m) => [m.subscriptionId, m.reminder, m.daysLeft]),
    [
      ["a", "FIRST_REMINDER", 2],
      ["b", "SECOND_REMINDER", 1],
    ]
  );
});

test("expired, far-off and already-reminded fees are not added", () => {
  const digests = collect([
    subscription({ id: "expired", end_date: "2026-07-17T00:00:00.000Z" }),
    subscription({ id: "far", end_date: "2026-08-18T00:00:00.000Z" }),
    subscription({ id: "done", end_date: "2026-07-20T00:00:00.000Z", first_reminder_sent: true }),
    subscription({ id: "done2", end_date: "2026-07-19T00:00:00.000Z", second_reminder_sent: true }),
  ]);

  assert.equal(digests.size, 0);
});

test("owner without an email still gets a digest entry, with no recipient", () => {
  const digests = collect([
    subscription({ id: "a", end_date: "2026-07-20T00:00:00.000Z", ownerEmail: null }),
  ]);

  assert.equal(digests.get("owner-1")!.ownerEmail, null);
});

test("members are sorted soonest first and flags are split by reminder", () => {
  const digests = collect([
    subscription({ id: "a", end_date: "2026-07-20T00:00:00.000Z", first_name: "Zain" }),
    subscription({ id: "b", end_date: "2026-07-19T00:00:00.000Z", first_name: "Usman" }),
    subscription({ id: "c", end_date: "2026-07-20T00:00:00.000Z", first_name: "Ali" }),
  ]);
  const members = sortDueSoonMembers(digests.get("owner-1")!.members);

  assert.deepEqual(members.map((m) => m.subscriptionId), ["b", "c", "a"]);
  assert.deepEqual(reminderFlagIds(members), { first: ["c", "a"], second: ["b"] });
});

test("digest email lists each member with fee, due date and phone, escaped", () => {
  const digests = collect([
    subscription({ id: "a", end_date: "2026-07-19T00:00:00.000Z", first_name: "<b>Ali</b>" }),
    subscription({ id: "b", end_date: "2026-07-20T00:00:00.000Z", first_name: "Hamza" }),
  ]);
  const digest = digests.get("owner-1")!;
  const email = getGymOwnerDueSoonEmail(
    digest.ownerName,
    sortDueSoonMembers(digest.members),
    "https://app.example.com/"
  );

  assert.equal(email.subject, "2 members' gym fees are due soon");
  assert.match(email.text, /Hi Bakar/);
  assert.match(email.text, /Tomorrow/);
  assert.match(email.text, /In 2 days/);
  assert.match(email.text, /03001234567/);
  assert.match(email.text, /3,000/);
  assert.match(email.html, /https:\/\/app\.example\.com\/membersubscriptions/);
  assert.ok(!email.html.includes("<b>Ali</b>"));
  assert.ok(email.html.includes("&lt;b&gt;Ali&lt;/b&gt;"));
  // Single gym: no Gym column.
  assert.ok(!email.html.includes(">Gym</th>"));
});

test("single-member subject names the member; multiple gyms add a Gym column", () => {
  const one = collect([subscription({ id: "a", end_date: "2026-07-19T00:00:00.000Z" })]).get("owner-1")!;
  assert.equal(
    getGymOwnerDueSoonEmail(one.ownerName, one.members).subject,
    "Ali Raza's gym fee is due tomorrow"
  );

  const two = collect([
    subscription({ id: "a", end_date: "2026-07-19T00:00:00.000Z", gymName: "Iron Zone · Gujrat" }),
    subscription({ id: "b", end_date: "2026-07-20T00:00:00.000Z", gymName: "Iron Zone · Lahore" }),
  ]).get("owner-1")!;
  const email = getGymOwnerDueSoonEmail(two.ownerName, two.members);
  assert.ok(email.html.includes(">Gym</th>"));
  assert.match(email.text, /Iron Zone · Lahore/);
  assert.ok(!email.text.includes("membersubscriptions"), "no link without an app URL");
});
