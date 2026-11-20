import type { CronAction } from "@/lib/cron/computeActions";

export type DueSoonReminderType = "FIRST_REMINDER" | "SECOND_REMINDER";

/** One member whose fee runs out soon, as listed in the owner's digest email. */
export type DueSoonMember = {
  subscriptionId: string;
  reminder: DueSoonReminderType;
  name: string;
  phone_number: string | null;
  gymName: string;
  gymCountry: string | null;
  price: number;
  billingModel: string;
  endDate: Date;
  daysLeft: number;
};

/** Everything needed to send one gym owner their daily "fees due soon" email. */
export type OwnerDueSoonDigest = {
  ownerId: string;
  ownerEmail: string | null;
  ownerName: string;
  members: DueSoonMember[];
};

type DueSoonSubscription = {
  id: string;
  price: number;
  billing_model: string;
  end_date: Date;
  member: {
    user: {
      first_name: string | null;
      last_name: string | null;
      phone_number: string | null;
    };
    gym: {
      name: string;
      country: string | null;
      owner: {
        id: string;
        email: string | null;
        first_name: string | null;
        last_name: string | null;
      };
    };
  };
};

const fullName = (first: string | null, last: string | null, fallback: string) =>
  `${first ?? ""} ${last ?? ""}`.trim() || fallback;

/**
 * Adds a member subscription to its owner's digest when the cron decided it is
 * due for a first or second reminder. Returns false for any other action.
 */
export function addDueSoonReminder(
  digests: Map<string, OwnerDueSoonDigest>,
  subscription: DueSoonSubscription,
  action: CronAction
): boolean {
  if (action.type !== "FIRST_REMINDER" && action.type !== "SECOND_REMINDER") {
    return false;
  }

  const { user, gym } = subscription.member;
  const owner = gym.owner;

  let digest = digests.get(owner.id);
  if (!digest) {
    digest = {
      ownerId: owner.id,
      ownerEmail: owner.email?.trim() || null,
      ownerName: fullName(owner.first_name, owner.last_name, "there"),
      members: [],
    };
    digests.set(owner.id, digest);
  }

  digest.members.push({
    subscriptionId: subscription.id,
    reminder: action.type,
    name: fullName(user.first_name, user.last_name, "Member"),
    phone_number: user.phone_number,
    gymName: gym.name,
    gymCountry: gym.country,
    price: subscription.price,
    billingModel: subscription.billing_model,
    endDate: subscription.end_date,
    daysLeft: action.daysLeft,
  });

  return true;
}

/** Soonest first, then by name, so the most urgent fees are at the top. */
export function sortDueSoonMembers(members: DueSoonMember[]): DueSoonMember[] {
  return [...members].sort(
    (a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name)
  );
}

/** The reminder flags to set once the owner's digest has been sent. */
export function reminderFlagIds(members: DueSoonMember[]) {
  return {
    first: members.filter((m) => m.reminder === "FIRST_REMINDER").map((m) => m.subscriptionId),
    second: members.filter((m) => m.reminder === "SECOND_REMINDER").map((m) => m.subscriptionId),
  };
}
