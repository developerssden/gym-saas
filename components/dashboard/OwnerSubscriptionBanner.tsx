"use client";

import { useSession } from "next-auth/react";
import { getDaysUntilExpiration } from "@/lib/date-utils";
import { AlertTriangle, XCircle } from "lucide-react";

export default function OwnerSubscriptionBanner() {
  const { data: session } = useSession();
  const endDateStr = session?.user?.subscription_end_date;

  if (!endDateStr) return null;

  const daysLeft = getDaysUntilExpiration(new Date(endDateStr));

  if (daysLeft > 7) return null;

  const isExpired = daysLeft <= 0;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium mb-4 ${
        isExpired
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-orange-300/50 bg-orange-50 text-orange-800 dark:border-orange-400/30 dark:bg-orange-950/30 dark:text-orange-300"
      }`}
    >
      {isExpired ? (
        <XCircle className="h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0" />
      )}
      <span>
        {isExpired
          ? "Your subscription has expired. Contact support to renew and restore full access."
          : `Your subscription expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Contact support to renew.`}
      </span>
    </div>
  );
}
