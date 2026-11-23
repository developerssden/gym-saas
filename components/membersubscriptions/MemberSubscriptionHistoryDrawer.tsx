"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CurrencyAmount } from "@/components/common/CurrencyAmount";
import { billingModelLabel, formatDate, formatDateRange, formatShortDate } from "@/lib/format";

interface Props {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
}

function getStatusLabel(sub: { is_expired: boolean; is_active: boolean; frozen_since?: string | null }) {
  if (sub.frozen_since) return { label: "Frozen", color: "outline" as const };
  if (sub.is_expired) return { label: "Expired", color: "destructive" as const };
  if (sub.is_active) return { label: "Active", color: "default" as const };
  return { label: "Inactive", color: "secondary" as const };
}

export function MemberSubscriptionHistoryDrawer({
  open,
  onClose,
  memberId,
  memberName,
}: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["membersubscription-history", memberId],
    queryFn: async () => {
      const res = await axios.post("/api/membersubscriptions/getmembersubscriptions", {
        page: 1,
        limit: 100,
        member_id: memberId,
      });
      return res.data;
    },
    enabled: open && !!memberId,
  });

  const subscriptions: Array<{
    id: string;
    start_date: string;
    end_date: string;
    price: number;
    billing_model: string;
    is_expired: boolean;
    is_active: boolean;
    frozen_since?: string | null;
    freezes?: Array<{
      id: string;
      start_date: string;
      end_date: string | null;
      days: number | null;
      reason: string | null;
    }>;
  }> = data?.data ?? [];

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Subscription History — {memberName}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-4">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}

          {!isLoading && subscriptions.length === 0 && (
            <p className="text-sm text-muted-foreground">No subscription history found.</p>
          )}

          {subscriptions.map((sub) => {
            const { label, color } = getStatusLabel(sub);
            return (
              <div
                key={sub.id}
                className="rounded-lg border p-4 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {formatDateRange(sub.start_date, sub.end_date)}
                  </span>
                  <Badge variant={color}>{label}</Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  <CurrencyAmount amount={sub.price} /> · {billingModelLabel(sub.billing_model)}
                </span>
                {sub.freezes && sub.freezes.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1 border-t pt-2 text-xs text-muted-foreground">
                    {sub.freezes.map((freeze) => (
                      <li key={freeze.id}>
                        <span className="font-medium text-foreground">Frozen</span>{" "}
                        {formatShortDate(freeze.start_date)}
                        {freeze.end_date
                          ? ` – ${formatDate(freeze.end_date)} (+${freeze.days ?? 0} day${freeze.days === 1 ? "" : "s"})`
                          : " – now"}
                        {freeze.reason ? ` · ${freeze.reason}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
