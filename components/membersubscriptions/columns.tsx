"use client";

import { useState } from "react";
import axios from "axios";
import { ColumnDef } from "@tanstack/react-table";
import { Banknote, History, Pencil, RotateCw, Snowflake, Sun, Trash2, UserRound, LogOut } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/getErrorMessage";
import RenewMemberModal from "@/components/dashboard/RenewMemberModal";
import QuickPaymentDialog from "@/components/payments/QuickPaymentDialog";
import ChurnReasonModal from "@/components/membersubscriptions/ChurnReasonModal";
import FreezeDialog from "@/components/membersubscriptions/FreezeDialog";
import { MemberSubscriptionHistoryDrawer } from "@/components/membersubscriptions/MemberSubscriptionHistoryDrawer";
import { WhatsAppReminderButton, WhatsAppReminderMenuItem } from "@/components/common/whatsapp-actions";
import { ListCard } from "@/components/common/list-card";
import { RowActions, type RowAction } from "@/components/common/row-actions";
import { useConfirm } from "@/components/common/confirm-dialog";
import { MemberStatusBadge, OwesBadge } from "@/components/members/member-status-badge";
import { usePermissions } from "@/hooks/usePermissions";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import { billingModelLabel, formatDate, formatDateRange } from "@/lib/format";
import type { MembershipState } from "@/lib/members/member-status";

/** One member's current (or latest) membership, from getmembers with_status. */
export type MembershipRow = {
  id: string;
  user: { first_name: string; last_name: string; email: string | null; phone_number: string | null };
  gym?: { name: string; country?: string | null } | null;
  membership: {
    state: MembershipState;
    label: string;
    days: number | null;
    endDate: string | null;
    startDate: string | null;
    frozenSince: string | null;
    isExpiredFlag: boolean;
    subscriptionId: string | null;
    price: number | null;
    billingModel: string | null;
    owes: boolean;
    /** null when the viewer may not see amounts. */
    balance: number | null;
  };
};

const nameOf = (r: MembershipRow) => `${r.user.first_name ?? ""} ${r.user.last_name ?? ""}`.trim() || "Member";

/** "23 days left", "Expires in 3 days", "Expired 5 days ago", "Frozen since 2 Nov 2026". */
function statusText(m: MembershipRow["membership"]) {
  if (m.state === "frozen") return m.frozenSince ? `Frozen since ${formatDate(m.frozenSince)}` : "Frozen";
  if (m.state === "active" && m.days !== null) return `${m.days} days left`;
  return m.label;
}

function Plan({ row }: { row: MembershipRow }) {
  const { format } = useGymCurrency();
  const m = row.membership;
  if (!m.billingModel) return <span className="text-muted-foreground">—</span>;
  // Amounts hidden for staff who can't see payments (balance comes back null).
  const showPrice = m.balance !== null && m.price !== null;
  return (
    <span className="whitespace-nowrap">
      {billingModelLabel(m.billingModel)}
      {showPrice && ` · ${format(m.price!)}`}
    </span>
  );
}

function Balance({ row }: { row: MembershipRow }) {
  const { format } = useGymCurrency();
  const m = row.membership;
  if (!m.owes) return <span className="text-sm font-medium text-primary-dim">Paid</span>;
  return <OwesBadge amount={m.balance !== null ? format(m.balance) : null} />;
}

export const columns: ColumnDef<MembershipRow>[] = [
  {
    id: "member",
    header: "Member",
    cell: ({ row }) => (
      <div className="flex min-w-[10rem] flex-col">
        <span className="font-medium">{nameOf(row.original)}</span>
        <span className="text-sm text-muted-foreground tabular-nums">{row.original.user.phone_number || "No phone"}</span>
      </div>
    ),
  },
  { id: "plan", header: "Plan", cell: ({ row }) => <Plan row={row.original} /> },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <MemberStatusBadge state={row.original.membership.state} label={statusText(row.original.membership)} />,
  },
  {
    id: "period",
    header: "Period",
    cell: ({ row }) => {
      const m = row.original.membership;
      return m.startDate && m.endDate ? (
        <span className="whitespace-nowrap text-sm">{formatDateRange(m.startDate, m.endDate)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  },
  { id: "balance", header: "Balance", cell: ({ row }) => <Balance row={row.original} /> },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    enableHiding: false,
    cell: ({ row }) => <MembershipActions row={row.original} />,
  },
];

/** Phone layout: tap opens the member's profile. */
export function MembershipCard({ row }: { row: MembershipRow }) {
  const m = row.membership;
  return (
    <ListCard
      href={`/members/${row.id}`}
      title={nameOf(row)}
      subtitle={<Plan row={row} />}
      status={
        <span className="flex flex-wrap justify-end gap-1.5">
          <MemberStatusBadge state={m.state} label={statusText(m)} />
          {m.owes && <Balance row={row} />}
        </span>
      }
      meta={m.startDate && m.endDate ? formatDateRange(m.startDate, m.endDate) : undefined}
      actions={<MembershipActions row={row} className="justify-start" />}
    />
  );
}

/**
 * The action that fits the status is a visible button (Record payment when they
 * owe, Renew when expiring or expired, Remind when expiring); the rest are under More.
 */
function MembershipActions({ row, className }: { row: MembershipRow; className?: string }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [paying, setPaying] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [history, setHistory] = useState(false);
  const [churn, setChurn] = useState(false);
  const [freezeMode, setFreezeMode] = useState<"freeze" | "unfreeze" | null>(null);

  const m = row.membership;
  const name = nameOf(row);
  const subId = m.subscriptionId;
  const dueOrOver = m.state === "expiring" || m.state === "expired";
  const canRecord = can("payments.record") || can("membersubscriptions.renew");
  const canRemind = can("membersubscriptions.whatsapp") && dueOrOver && !!m.endDate;

  const remove = useMutation({
    mutationFn: () => axios.post("/api/membersubscriptions/deletemembersubscription-owner", { id: subId }),
    onSuccess: () => {
      toast.success(`Deleted ${name}'s membership`);
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["membersubscriptions"] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const askDelete = async () => {
    const ok = await confirm({
      title: `Delete ${name}'s membership?`,
      description: `${m.startDate && m.endDate ? `${formatDateRange(m.startDate, m.endDate)}. ` : ""}It's removed from their history and no longer counts towards what they owe. This can't be undone.`,
      confirmLabel: "Delete membership",
      destructive: true,
    });
    if (ok) remove.mutate();
  };

  const primary: RowAction[] = [];
  if (m.owes && canRecord) primary.push({ label: "Record payment", icon: Banknote, onClick: () => setPaying(true) });
  if (dueOrOver && can("membersubscriptions.renew") && subId) primary.push({ label: "Renew", icon: RotateCw, onClick: () => setRenewing(true) });
  // Remind gets a button when there's room; otherwise it's in More.
  const remindVisible = canRemind && primary.length < 2;

  const more: RowAction[] = [
    { label: "View profile", icon: UserRound, href: `/members/${row.id}` },
    { label: "History", icon: History, onClick: () => setHistory(true) },
    {
      label: m.state === "frozen" ? "Unfreeze (they're back)" : "Freeze",
      icon: m.state === "frozen" ? Sun : Snowflake,
      onClick: () => setFreezeMode(m.state === "frozen" ? "unfreeze" : "freeze"),
      hidden: !can("membersubscriptions.freeze") || !subId || !(m.state === "frozen" || m.state === "active" || m.state === "expiring"),
    },
    {
      label: "Edit",
      icon: Pencil,
      href: `/membersubscriptions/manage?action=edit&id=${subId}`,
      hidden: !can("membersubscriptions.edit") || !subId,
    },
    {
      label: "Record why they left",
      icon: LogOut,
      onClick: () => setChurn(true),
      hidden: m.state !== "expired" || !can("membersubscriptions.edit") || !subId,
    },
    { label: "Delete", icon: Trash2, destructive: true, onClick: askDelete, hidden: !can("membersubscriptions.delete") || !subId },
  ];

  const reminderProps = {
    memberName: name,
    phone: row.user.phone_number,
    gymName: row.gym?.name,
    gymCountry: row.gym?.country,
    price: m.price ?? 0,
    endDate: m.endDate ?? new Date(),
    isExpired: m.state === "expired",
  };

  return (
    <div className={`flex items-center gap-2 ${className ?? "justify-end"}`}>
      {confirmDialog}
      {remindVisible && <WhatsAppReminderButton {...reminderProps} className="h-11 md:h-9" />}
      <RowActions
        visible={remindVisible ? (Math.min(primary.length, 1) as 0 | 1) : (Math.min(primary.length, 2) as 0 | 1 | 2)}
        moreLabel={`More actions for ${name}`}
        actions={[...primary, ...more]}
        moreItems={canRemind && !remindVisible ? <WhatsAppReminderMenuItem {...reminderProps} /> : undefined}
      />

      {paying && <QuickPaymentDialog open onClose={() => setPaying(false)} member={{ id: row.id, name }} />}
      {renewing && (
        <RenewMemberModal
          open
          onClose={() => setRenewing(false)}
          memberId={row.id}
          memberName={name}
          defaultPrice={m.price ?? 0}
          defaultBillingModel={m.billingModel ?? "MONTHLY"}
        />
      )}
      {history && <MemberSubscriptionHistoryDrawer open onClose={() => setHistory(false)} memberId={row.id} memberName={name} />}
      {subId && freezeMode && m.startDate && m.endDate && (
        <FreezeDialog
          open
          onClose={() => setFreezeMode(null)}
          mode={freezeMode}
          subscriptionId={subId}
          memberName={name}
          startDate={m.startDate}
          endDate={m.endDate}
          frozenSince={m.frozenSince}
        />
      )}
      {subId && churn && <ChurnReasonModal open onClose={() => setChurn(false)} subscriptionId={subId} memberName={name} />}
    </div>
  );
}
