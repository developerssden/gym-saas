"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

type MemberSubscription = {
  id: string;
  member: {
    user: {
      first_name: string;
      last_name: string;
      email: string | null;
    };
  };
  price: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_expired: boolean;
};

// Separate component for actions cell to use hooks
function MemberSubscriptionActionsCell({ subscription }: { subscription: MemberSubscription }) {
  const queryClient = useQueryClient();

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/membersubscriptions/manage?action=edit&id=${subscription.id}`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </DropdownMenuItem>
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
      </DropdownMenuContent>
    </DropdownMenu>
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
    cell: ({ row }) => {
      return `$${row.original.price.toFixed(2)}`;
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
    cell: ({ row }) => {
      return <MemberSubscriptionActionsCell subscription={row.original} />;
    },
  },
];

