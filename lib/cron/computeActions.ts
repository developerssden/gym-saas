import {
  DEFAULT_BUSINESS_TIME_ZONE,
  getDaysUntilExpiration,
} from "@/lib/date-utils";
import { REMINDER_DAYS } from "@/lib/constants";

export type CronAction =
  | {
      type: "EXPIRE";
      id: string;
      ownerEmail?: string;
      ownerName?: string;
      planName?: string;
    }
  | {
      type: "FIRST_REMINDER";
      id: string;
      email: string;
      name: string;
      daysLeft: number;
      planName?: string;
    }
  | {
      type: "SECOND_REMINDER";
      id: string;
      email: string;
      name: string;
      daysLeft: number;
      planName?: string;
    }
  | { type: "NONE"; id: string };

type OwnerSubscriptionInput = {
  id: string;
  end_date: Date;
  notification_sent: boolean;
  first_reminder_sent: boolean;
  second_reminder_sent: boolean;
  owner: {
    email: string | null;
    first_name: string | null;
    last_name: string | null;
  };
  plan: { name: string };
};

type MemberSubscriptionInput = {
  id: string;
  end_date: Date;
  notification_sent: boolean;
  first_reminder_sent: boolean;
  second_reminder_sent: boolean;
  member: {
    user: {
      email: string | null;
      first_name: string | null;
      last_name: string | null;
    };
  };
};

export function computeOwnerActions(
  subscriptions: OwnerSubscriptionInput[],
  referenceDate = new Date(),
  timeZone = DEFAULT_BUSINESS_TIME_ZONE
): CronAction[] {
  return subscriptions.map((sub) => {
    const daysLeft = getDaysUntilExpiration(
      sub.end_date,
      referenceDate,
      timeZone
    );
    const ownerName = `${sub.owner.first_name ?? ""} ${sub.owner.last_name ?? ""}`.trim() || "Owner";

    if (daysLeft <= 0 && !sub.notification_sent) {
      return {
        type: "EXPIRE",
        id: sub.id,
        ownerEmail: sub.owner.email ?? undefined,
        ownerName,
        planName: sub.plan.name,
      };
    }
    if (
      daysLeft > 0 &&
      daysLeft <= REMINDER_DAYS.SECOND &&
      !sub.second_reminder_sent
    ) {
      return {
        type: "SECOND_REMINDER",
        id: sub.id,
        email: sub.owner.email ?? "",
        name: ownerName,
        daysLeft,
        planName: sub.plan.name,
      };
    }
    if (
      daysLeft > REMINDER_DAYS.SECOND &&
      daysLeft <= REMINDER_DAYS.FIRST &&
      !sub.first_reminder_sent
    ) {
      return {
        type: "FIRST_REMINDER",
        id: sub.id,
        email: sub.owner.email ?? "",
        name: ownerName,
        daysLeft,
        planName: sub.plan.name,
      };
    }
    return { type: "NONE", id: sub.id };
  });
}

export function computeMemberActions(
  subscriptions: MemberSubscriptionInput[],
  referenceDate = new Date(),
  timeZone = DEFAULT_BUSINESS_TIME_ZONE
): CronAction[] {
  return subscriptions.map((sub) => {
    const daysLeft = getDaysUntilExpiration(
      sub.end_date,
      referenceDate,
      timeZone
    );
    const email = sub.member?.user?.email ?? "";
    const name = `${sub.member.user.first_name ?? ""} ${sub.member.user.last_name ?? ""}`.trim() || "Member";

    if (daysLeft <= 0 && !sub.notification_sent) {
      return {
        type: "EXPIRE",
        id: sub.id,
        ownerEmail: email,
        ownerName: name,
      };
    }
    if (
      daysLeft > 0 &&
      daysLeft <= REMINDER_DAYS.SECOND &&
      !sub.second_reminder_sent
    ) {
      return {
        type: "SECOND_REMINDER",
        id: sub.id,
        email,
        name,
        daysLeft,
      };
    }
    if (
      daysLeft > REMINDER_DAYS.SECOND &&
      daysLeft <= REMINDER_DAYS.FIRST &&
      !sub.first_reminder_sent
    ) {
      return {
        type: "FIRST_REMINDER",
        id: sub.id,
        email,
        name,
        daysLeft,
      };
    }
    return { type: "NONE", id: sub.id };
  });
}
