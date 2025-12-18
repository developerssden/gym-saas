/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OwnerSubscription } from "@/types";
import { ColumnDef } from "@tanstack/react-table";
import {
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  RotateCwIcon,
  PencilIcon,
} from "lucide-react";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { useMemo, useState } from "react";
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
    accessorFn: (row) =>
      `${row.owner?.first_name ?? ""} ${row.owner?.last_name ?? ""}`.trim(),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Owner" />
    ),
    cell: ({ row }) => {
      const o = row.original.owner;
      return (
        <div className="flex flex-col">
          <span className="font-medium">
            {o?.first_name || o?.last_name
              ? `${o?.first_name ?? ""} ${o?.last_name ?? ""}`.trim()
              : "-"}
          </span>
          <span className="text-xs text-muted-foreground">
            {o?.email ?? ""}
          </span>
        </div>
      );
    },
  },
  {
    id: "plan",
    accessorFn: (row) => row.plan?.name ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Plan" />
    ),
    cell: ({ row }) => row.original.plan?.name ?? "-",
  },
  {
    accessorKey: "billing_model",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Billing" />
    ),
    cell: ({ row }) => row.original.billing_model,
  },
  {
    accessorKey: "start_date",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Start" />
    ),
    cell: ({ row }) => formatDate(row.original.start_date),
  },
  {
    accessorKey: "end_date",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="End" />
    ),
    cell: ({ row }) => formatDate(row.original.end_date),
  },
  {
    accessorKey: "is_expired",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Expired" />
    ),
    cell: ({ row }) => (row.original.is_expired ? "Yes" : "No"),
  },
  {
    accessorKey: "is_active",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Active" />
    ),
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
  const [renewOpen, setRenewOpen] = useState(false);

  const suggestedAmount = useMemo(() => {
    const plan = subscription.plan;
    if (!plan) return "";
    return subscription.billing_model === "MONTHLY"
      ? String(plan.monthly_price)
      : String(plan.yearly_price);
  }, [subscription.billing_model, subscription.plan]);

  const [renewForm, setRenewForm] = useState({
    billing_model: subscription.billing_model ?? "MONTHLY",
    amount: "",
    payment_method: "CASH" as "CASH" | "BANK_TRANSFER",
    transaction_id: "",
    payment_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const { mutate: renewSubscription, isPending: isRenewing } = useMutation({
    mutationFn: async () => {
      const amountToSend =
        renewForm.amount && String(renewForm.amount).trim() !== ""
          ? renewForm.amount
          : suggestedAmount;
      return axios.post("/api/subscription/renewsubscription", {
        subscription_id: subscription.id,
        billing_model: renewForm.billing_model,
        amount: amountToSend,
        payment_method: renewForm.payment_method,
        transaction_id: renewForm.transaction_id || undefined,
        payment_date: renewForm.payment_date
          ? new Date(renewForm.payment_date).toISOString()
          : undefined,
        notes: renewForm.notes || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Subscription renewed successfully");
      queryClient.invalidateQueries({ queryKey: ["ownerSubscriptions"] });
      setRenewOpen(false);
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to renew subscription"
      );
    },
  });

  const { mutate: deleteSubscription, isPending: isDeleting } = useMutation({
    mutationFn: async () =>
      axios.post("/api/subscription/deletesubscription", {
        id: subscription.id,
      }),
    onSuccess: () => {
      toast.success("Subscription deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["ownerSubscriptions"] });
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || "Failed to delete subscription"
      );
    },
  });

  const { mutate: toggleActive, isPending: isToggling } = useMutation({
    mutationFn: async () =>
      axios.post("/api/subscription/activesubscription", {
        id: subscription.id,
      }),
    onSuccess: () => {
      toast.success("Subscription status updated");
      queryClient.invalidateQueries({ queryKey: ["ownerSubscriptions"] });
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || "Failed to update subscription status"
      );
    },
  });

  return (
    <div className="flex gap-2">
      <Button
        asChild
        size="icon"
        variant="outline"
        className="rounded"
        title="Edit"
      >
        <Link href={`/subscriptions/manage?action=edit&id=${subscription.id}`}>
          <PencilIcon size={16} />
        </Link>
      </Button>

      <Button
        size="icon"
        variant="outline"
        onClick={() => {
          setRenewForm((prev) => ({
            ...prev,
            billing_model: subscription.billing_model ?? prev.billing_model,
            amount: "",
            payment_method: "CASH",
            transaction_id: "",
            payment_date: new Date().toISOString().slice(0, 10),
            notes: "",
          }));
          setRenewOpen(true);
        }}
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

      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renew Subscription</DialogTitle>
            <DialogDescription>
              This will create a new subscription term and record a new payment
              (invoice).
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Billing Model</Label>
              <Select
                value={renewForm.billing_model}
                onValueChange={(val) =>
                  setRenewForm((p) => ({ ...p, billing_model: val as any }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select billing model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                value={renewForm.amount}
                onChange={(e) =>
                  setRenewForm((p) => ({ ...p, amount: e.target.value }))
                }
                placeholder={
                  suggestedAmount
                    ? `Suggested: ${suggestedAmount}`
                    : "Enter amount"
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={renewForm.payment_method}
                onValueChange={(val) =>
                  setRenewForm((p) => ({ ...p, payment_method: val as any }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Transaction ID</Label>
              <Input
                type="text"
                value={renewForm.transaction_id}
                onChange={(e) =>
                  setRenewForm((p) => ({
                    ...p,
                    transaction_id: e.target.value,
                  }))
                }
                disabled={renewForm.payment_method === "CASH"}
                placeholder={
                  renewForm.payment_method === "BANK_TRANSFER"
                    ? "Required for bank transfer"
                    : "Auto-generated for cash if empty"
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={renewForm.payment_date}
                onChange={(e) =>
                  setRenewForm((p) => ({ ...p, payment_date: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={renewForm.notes}
                onChange={(e) =>
                  setRenewForm((p) => ({ ...p, notes: e.target.value }))
                }
                rows={3}
                placeholder="Notes (optional)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenewOpen(false)}
              disabled={isRenewing}
            >
              Cancel
            </Button>
            <Button
              onClick={() => renewSubscription()}
              disabled={
                isRenewing ||
                !renewForm.payment_method ||
                (renewForm.payment_method === "BANK_TRANSFER" &&
                  !renewForm.transaction_id)
              }
            >
              Renew & Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              This action cannot be undone. This will delete the subscription
              for{" "}
              <span className="font-medium">
                {subscription.owner?.first_name} {subscription.owner?.last_name}
              </span>
              .
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
        {subscription.is_active ? (
          <CheckCircleIcon size={16} />
        ) : (
          <XCircleIcon size={16} />
        )}
      </Button>
    </div>
  );
};
