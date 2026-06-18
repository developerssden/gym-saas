"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Props {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
}

function getStatusLabel(sub: { is_expired: boolean; is_active: boolean }) {
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
                    {format(new Date(sub.start_date), "MMM d, yyyy")} —{" "}
                    {format(new Date(sub.end_date), "MMM d, yyyy")}
                  </span>
                  <Badge variant={color}>{label}</Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  Rs {sub.price.toLocaleString()} · {sub.billing_model}
                </span>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
