"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";
import { Banknote, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { usePermissions } from "@/hooks/usePermissions";
import QuickPaymentDialog from "@/components/payments/QuickPaymentDialog";
import { useConfirm } from "@/components/common/confirm-dialog";
import { formatDate } from "@/lib/format";

type Member = {
  id: string;
  user: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone_number: string;
  };
  gym: {
    id: string;
    name: string;
  };
  location: {
    id: string;
    name: string;
  };
  joinedAt: string;
};

export const columns: ColumnDef<Member>[] = [
  {
    accessorKey: "user.first_name",
    header: "Name",
    cell: ({ row }) => {
      const member = row.original;
      return `${member.user.first_name} ${member.user.last_name}`;
    },
  },
  {
    accessorKey: "user.email",
    header: "Email",
    cell: ({ row }) => row.original.user.email || "-",
  },
  {
    accessorKey: "user.phone_number",
    header: "Phone",
    cell: ({ row }) => row.original.user.phone_number || "-",
  },
  {
    accessorKey: "gym.name",
    header: "Gym",
    cell: ({ row }) => row.original.gym.name,
  },
  {
    accessorKey: "location.name",
    header: "Location",
    cell: ({ row }) => row.original.location.name,
  },
  {
    accessorKey: "joinedAt",
    header: "Joined",
    cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.joinedAt)}</span>,
  },
  {
    id: "actions",
    header: "Actions",
    enableHiding: false,
    cell: ({ row }) => <MemberActionsCell member={row.original} />,
  },
];


// Separate component so the actions cell can use hooks
function MemberActionsCell({ member }: { member: Member }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canEdit = can("members.edit");
  const canDelete = can("members.delete");
  const canTakeFee = can("payments.record") || can("membersubscriptions.renew");
  const [paying, setPaying] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await axios.post("/api/members/deletemember", { id: member.id });
    },
    onSuccess: () => {
      toast.success("Member deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  if (!canEdit && !canDelete && !canTakeFee) return null;

  return (
    <>
    {confirmDialog}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canTakeFee && (
          <DropdownMenuItem onClick={() => setPaying(true)}>
            <Banknote className="mr-2 h-4 w-4" />
            Record payment
          </DropdownMenuItem>
        )}
        {canEdit && (
          <DropdownMenuItem asChild>
            <Link href={`/members/manage?action=edit&id=${member.id}`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem
            onClick={async () => {
              const name = `${member.user.first_name} ${member.user.last_name}`.trim() || "this member";
              const ok = await confirm({
                title: `Delete ${name}?`,
                description: "They're removed from your members and can no longer be renewed or sent reminders. This can't be undone.",
                confirmLabel: "Delete member",
                destructive: true,
              });
              if (ok) deleteMutation.mutate();
            }}
            className="text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    <QuickPaymentDialog
      open={paying}
      onClose={() => setPaying(false)}
      member={{ id: member.id, name: `${member.user.first_name} ${member.user.last_name}`.trim() }}
    />
    </>
  );
}
