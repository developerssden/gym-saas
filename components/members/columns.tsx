"use client";

import { useState } from "react";
import axios from "axios";
import { ColumnDef } from "@tanstack/react-table";
import { Banknote, Pencil, Trash2, UserRound } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { usePermissions } from "@/hooks/usePermissions";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import QuickPaymentDialog from "@/components/payments/QuickPaymentDialog";
import { useConfirm } from "@/components/common/confirm-dialog";
import { ListCard } from "@/components/common/list-card";
import { RowActions } from "@/components/common/row-actions";
import { MemberStatusBadge, OwesBadge } from "@/components/members/member-status-badge";
import { formatDate } from "@/lib/format";
import type { MembershipState } from "@/lib/members/member-status";

export type MemberRow = {
  id: string;
  user: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone_number: string | null;
  };
  joinedAt: string;
  membership: {
    state: MembershipState;
    label: string;
    days: number | null;
    endDate: string | null;
    owes: boolean;
    /** null when the viewer may not see amounts. */
    balance: number | null;
  };
};

export const memberName = (m: MemberRow) => `${m.user.first_name ?? ""} ${m.user.last_name ?? ""}`.trim() || "Member";
export const memberHref = (m: MemberRow) => `/members/${m.id}`;

function StatusBadges({ member }: { member: MemberRow }) {
  const { format } = useGymCurrency();
  const { membership } = member;
  return (
    <span className="flex flex-wrap items-center justify-end gap-1.5 md:justify-start">
      <MemberStatusBadge state={membership.state} label={membership.label} />
      {membership.owes && <OwesBadge amount={membership.balance !== null ? format(membership.balance) : null} />}
    </span>
  );
}

const endLabel = (m: MemberRow) => {
  if (!m.membership.endDate || m.membership.state === "frozen") return null;
  return `${m.membership.state === "expired" ? "Ended" : "Ends"} ${formatDate(m.membership.endDate)}`;
};

export const columns: ColumnDef<MemberRow>[] = [
  {
    id: "name",
    header: "Member",
    cell: ({ row }) => (
      <div className="flex min-w-[10rem] flex-col">
        <span className="font-medium">{memberName(row.original)}</span>
        <span className="text-sm text-muted-foreground tabular-nums">{row.original.user.phone_number || "No phone"}</span>
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadges member={row.original} />,
  },
  {
    id: "ends",
    header: "Membership ends",
    cell: ({ row }) =>
      row.original.membership.endDate ? (
        <span className="whitespace-nowrap">{formatDate(row.original.membership.endDate)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "joined",
    header: "Joined",
    cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(row.original.joinedAt)}</span>,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    enableHiding: false,
    cell: ({ row }) => <MemberActions member={row.original} />,
  },
];

/** Phone layout for one member: tap opens their profile. */
export function MemberCard({ member }: { member: MemberRow }) {
  return (
    <ListCard
      href={memberHref(member)}
      title={memberName(member)}
      subtitle={member.user.phone_number || "No phone"}
      status={<StatusBadges member={member} />}
      meta={endLabel(member)}
      actions={<MemberActions member={member} className="justify-start" />}
    />
  );
}

function MemberActions({ member, className }: { member: MemberRow; className?: string }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [paying, setPaying] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const name = memberName(member);

  const remove = useMutation({
    mutationFn: () => axios.post("/api/members/deletemember", { id: member.id }),
    onSuccess: () => {
      toast.success(`Deleted ${name}`);
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const askDelete = async () => {
    const ok = await confirm({
      title: `Delete ${name}?`,
      description: "They're removed from your members and can no longer be renewed or sent reminders. This can't be undone.",
      confirmLabel: "Delete member",
      destructive: true,
    });
    if (ok) remove.mutate();
  };

  return (
    <>
      {confirmDialog}
      <RowActions
        className={className}
        visible={1}
        moreLabel={`More actions for ${name}`}
        actions={[
          {
            label: "Record payment",
            icon: Banknote,
            onClick: () => setPaying(true),
            hidden: !(can("payments.record") || can("membersubscriptions.renew")),
          },
          { label: "View profile", icon: UserRound, href: memberHref(member) },
          { label: "Edit", icon: Pencil, href: `/members/manage?action=edit&id=${member.id}`, hidden: !can("members.edit") },
          { label: "Delete", icon: Trash2, destructive: true, onClick: askDelete, hidden: !can("members.delete") },
        ]}
      />
      <QuickPaymentDialog open={paying} onClose={() => setPaying(false)} member={{ id: member.id, name }} />
    </>
  );
}
