"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MoreHorizontal, Pencil, RotateCw, Trash2, History, Banknote, Snowflake, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/getErrorMessage";
import RenewMemberModal from "@/components/dashboard/RenewMemberModal";
import { CurrencyAmount } from "@/components/common/CurrencyAmount";
import ChurnReasonModal from "@/components/membersubscriptions/ChurnReasonModal";
import { MemberSubscriptionHistoryDrawer } from "@/components/membersubscriptions/MemberSubscriptionHistoryDrawer";
import { WhatsAppReminderMenuItem } from "@/components/common/whatsapp-actions";
import RecordPaymentModal from "@/components/membersubscriptions/RecordPaymentModal";
import FreezeDialog from "@/components/membersubscriptions/FreezeDialog";
import { usePermissions } from "@/hooks/usePermissions";

export type MemberSubscription = {
  id: string;
  member_id: string;
  member: {
    user: {
      first_name: string;
      last_name: string;
      email: string | null;
      phone_number?: string | null;
    };
    gym?: {
      name: string;
      country?: string | null;
    } | null;
  };
  price: number;
  discount?: number;
  admission_fee?: number;
  /** Added by the API: price - discount + admission fee. */
  amount_due?: number;
  amount_paid?: number;
  balance?: number;
  billing_model: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_expired: boolean;
  /** Set while the membership is paused. */
  frozen_since?: string | null;
};

// Separate component for actions cell to use hooks
function MemberSubscriptionActionsCell({ subscription }: { subscription: MemberSubscription }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showChurnModal, setShowChurnModal] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [freezeMode, setFreezeMode] = useState<"freeze" | "unfreeze" | null>(null);
  const isFrozen = !!subscription.frozen_since;
  const canFreeze = subscription.is_active && !subscription.is_expired && !isFrozen;
  const balance = subscription.balance ?? 0;

  const memberName =
    `${subscription.member?.user?.first_name ?? ""} ${subscription.member?.user?.last_name ?? ""}`.trim() ||
    "Member";

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await axios.post("/api/membersubscriptions/deletemembersubscription-owner", {
        id: subscription.id,
      });
    },
    onSuccess: () => {
      toast.success("Member subscription deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["membersubscriptions"] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {can("membersubscriptions.edit") && (
            <DropdownMenuItem asChild>
              <Link href={`/membersubscriptions/manage?action=edit&id=${subscription.id}`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </DropdownMenuItem>
          )}
          {balance > 0 && can("payments.record") && (
            <DropdownMenuItem onClick={() => setShowRecordPayment(true)}>
              <Banknote className="mr-2 h-4 w-4" />
              Record payment
            </DropdownMenuItem>
          )}
          {!can("membersubscriptions.freeze") ? null : isFrozen ? (
            <DropdownMenuItem onClick={() => setFreezeMode("unfreeze")}>
              <Sun className="mr-2 h-4 w-4" />
              Unfreeze (member is back)
            </DropdownMenuItem>
          ) : (
            canFreeze && (
              <DropdownMenuItem onClick={() => setFreezeMode("freeze")}>
                <Snowflake className="mr-2 h-4 w-4" />
                Freeze membership
              </DropdownMenuItem>
            )
          )}
          {!isFrozen && can("membersubscriptions.whatsapp") && <WhatsAppReminderMenuItem
            memberName={memberName}
            phone={subscription.member.user.phone_number}
            gymName={subscription.member.gym?.name}
            gymCountry={subscription.member.gym?.country}
            price={subscription.price}
            endDate={subscription.end_date}
            isExpired={subscription.is_expired}
          />}
          <DropdownMenuItem onClick={() => setShowHistoryDrawer(true)}>
            <History className="mr-2 h-4 w-4" />
            View History
          </DropdownMenuItem>
          {can("membersubscriptions.renew") && (
            <DropdownMenuItem
              onClick={() => setShowRenewModal(true)}
              disabled={subscription.is_active && !subscription.is_expired}
            >
              <RotateCw className="mr-2 h-4 w-4" />
              Renew
            </DropdownMenuItem>
          )}
          {subscription.is_expired && can("membersubscriptions.edit") && (
            <DropdownMenuItem onClick={() => setShowChurnModal(true)}>
              Record why they left
            </DropdownMenuItem>
          )}
          {can("membersubscriptions.delete") && (
          <>
          <DropdownMenuSeparator />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                }}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the member subscription
                  for{" "}
                  <span className="font-medium">
                    {subscription.member.user.first_name} {subscription.member.user.last_name}
                  </span>
                  . You will be able to create a new subscription for this member after deletion.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <RenewMemberModal
        open={showRenewModal}
        onClose={() => setShowRenewModal(false)}
        memberId={subscription.member_id}
        memberName={memberName}
        defaultPrice={subscription.price}
        defaultBillingModel={subscription.billing_model}
      />

      <MemberSubscriptionHistoryDrawer
        open={showHistoryDrawer}
        onClose={() => setShowHistoryDrawer(false)}
        memberId={subscription.member_id}
        memberName={memberName}
      />

      <FreezeDialog
        open={freezeMode !== null}
        onClose={() => setFreezeMode(null)}
        mode={freezeMode ?? "freeze"}
        subscriptionId={subscription.id}
        memberName={memberName}
        startDate={subscription.start_date}
        endDate={subscription.end_date}
        frozenSince={subscription.frozen_since}
      />

      <RecordPaymentModal
        open={showRecordPayment}
        onClose={() => setShowRecordPayment(false)}
        subscriptionId={subscription.id}
        memberName={memberName}
        balance={balance}
      />

      <ChurnReasonModal
        open={showChurnModal}
        onClose={() => setShowChurnModal(false)}
        subscriptionId={subscription.id}
        memberName={memberName}
      />
    </>
  );
}

export const columns: ColumnDef<MemberSubscription>[] = [
  {
    accessorKey: "member.user.first_name",
    header: "Member",
    cell: ({ row }) => {
      const sub = row.original;
      return `${sub.member.user.first_name} ${sub.member.user.last_name}`;
    },
  },
  {
    accessorKey: "price",
    header: "Price",
    cell: ({ row }) => <CurrencyAmount amount={row.original.price} />,
  },
  {
    id: "balance",
    header: "Balance",
    cell: ({ row }) => {
      const { balance, amount_paid, amount_due } = row.original;
      if (balance === undefined) return "-";
      if (balance <= 0) {
        return <span className="text-sm font-medium text-primary-dim">Paid</span>;
      }
      return (
        <div className="flex flex-col">
          <CurrencyAmount amount={balance} className="font-semibold text-destructive" />
          <span className="text-xs text-muted-foreground">
            paid <CurrencyAmount amount={amount_paid ?? 0} /> of <CurrencyAmount amount={amount_due ?? 0} />
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "start_date",
    header: "Start Date",
    cell: ({ row }) => {
      const date = new Date(row.original.start_date);
      return date.toLocaleDateString();
    },
  },
  {
    accessorKey: "end_date",
    header: "End Date",
    cell: ({ row }) => {
      const date = new Date(row.original.end_date);
      return date.toLocaleDateString();
    },
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) => {
      const sub = row.original;
      if (sub.frozen_since) {
        return (
          <span className="flex flex-col">
            <span className="text-sky-600 dark:text-sky-400">Frozen</span>
            <span className="text-xs text-muted-foreground">
              since {new Date(sub.frozen_since).toLocaleDateString()}
            </span>
          </span>
        );
      }
      if (sub.is_expired) {
        return <span className="text-red-500">Expired</span>;
      }
      if (sub.is_active) {
        return <span className="text-green-500">Active</span>;
      }
      return <span className="text-gray-500">Inactive</span>;
    },
  },
  {
    id: "actions",
    header: "Actions",
    enableHiding: false,
    cell: ({ row }) => {
      return <MemberSubscriptionActionsCell subscription={row.original} />;
    },
  },
];
