/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import type { OwnerSubscription } from "@/types";
import { ColumnDef } from "@tanstack/react-table";
import { TrashIcon, CheckCircleIcon, XCircleIcon, RotateCwIcon } from "lucide-react";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

const formatDate = (value: unknown) => {
  const d = value instanceof Date ? value : new Date(value as any);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
};

// Column definitions for TanStack table
export const columns: ColumnDef<OwnerSubscription>[] = [
  {
    id: "owner",
    accessorFn: (row) => `${row.owner?.first_name ?? ""} ${row.owner?.last_name ?? ""}`.trim(),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Owner" />,
    cell: ({ row }) => {
      const o = row.original.owner;
      return (
        <div className="flex flex-col">
          <span className="font-medium">
            {(o?.first_name || o?.last_name) ? `${o?.first_name ?? ""} ${o?.last_name ?? ""}`.trim() : "-"}
          </span>
          <span className="text-xs text-muted-foreground">{o?.email ?? ""}</span>
        </div>
      );
    },
  },
  {
    id: "plan",
    accessorFn: (row) => row.plan?.name ?? "",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Plan" />,
    cell: ({ row }) => row.original.plan?.name ?? "-",
  },
  {
    accessorKey: "billing_model",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Billing" />,
    cell: ({ row }) => row.original.billing_model,
  },
  {
    accessorKey: "start_date",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Start" />,
    cell: ({ row }) => formatDate(row.original.start_date),
  },
  {
    accessorKey: "end_date",
    header: ({ column }) => <DataTableColumnHeader column={column} title="End" />,
    cell: ({ row }) => formatDate(row.original.end_date),
  },
  {
    accessorKey: "is_expired",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Expired" />,
    cell: ({ row }) => (row.original.is_expired ? "Yes" : "No"),
  },
  {
    accessorKey: "is_active",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Active" />,
    cell: ({ row }) => (row.original.is_active ? "Yes" : "No"),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <ActionCell subscription={row.original} />,
  },
];

const ActionCell = ({ subscription }: { subscription: OwnerSubscription }) => {
  const queryClient = useQueryClient();

  const { mutate: renewSubscription, isPending: isRenewing } = useMutation({
    mutationFn: async () =>
      axios.post("/api/subscription/renewsubscription", {
        subscription_id: subscription.id,
      }),
    onSuccess: () => {
      toast.success("Subscription renewed successfully");
      queryClient.invalidateQueries({ queryKey: ["ownerSubscriptions"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to renew subscription");
    },
  });

  const { mutate: deleteSubscription, isPending: isDeleting } = useMutation({
    mutationFn: async () => axios.post("/api/subscription/deletesubscription", { id: subscription.id }),
    onSuccess: () => {
      toast.success("Subscription deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["ownerSubscriptions"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete subscription");
    },
  });

  const { mutate: toggleActive, isPending: isToggling } = useMutation({
    mutationFn: async () => axios.post("/api/subscription/activesubscription", { id: subscription.id }),
    onSuccess: () => {
      toast.success("Subscription status updated");
      queryClient.invalidateQueries({ queryKey: ["ownerSubscriptions"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update subscription status");
    },
  });

  return (
    <div className="flex gap-2">
      <Button
        size="icon"
        variant="outline"
        onClick={() => renewSubscription()}
        disabled={!subscription.is_expired || isRenewing}
        className="rounded text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        title={
          subscription.is_expired
            ? "Renew (start/end updated from today based on billing model)"
            : "Renew is available only when subscription is expired"
        }
      >
        <RotateCwIcon size={16} />
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className="rounded text-red-600 hover:text-red-700 hover:bg-red-50"
            disabled={isDeleting}
            title="Delete"
          >
            <TrashIcon size={16} />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will delete the subscription for{" "}
              <span className="font-medium">
                {subscription.owner?.first_name} {subscription.owner?.last_name}
              </span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSubscription()}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button
        size="icon"
        variant="outline"
        onClick={() => toggleActive()}
        disabled={isToggling}
        className={`rounded ${
          subscription.is_active
            ? "text-green-500 hover:text-green-600 hover:bg-green-50"
            : "text-gray-400 hover:text-green-500 hover:bg-gray-50"
        }`}
        title={subscription.is_active ? "Deactivate" : "Activate"}
      >
        {subscription.is_active ? <CheckCircleIcon size={16} /> : <XCircleIcon size={16} />}
      </Button>
    </div>
  );
};
