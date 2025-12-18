/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import type { Payment } from "@/types";
import { ColumnDef } from "@tanstack/react-table";
import { FileTextIcon } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const formatDate = (value: unknown) => {
  const d = value instanceof Date ? value : new Date(value as any);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

// Column definitions for TanStack table
export const columns: ColumnDef<Payment>[] = [
  {
    id: "subscription",
    accessorFn: (row) => {
      if (row.subscription_type === "OWNER") {
        return `${row.ownerSubscription?.owner?.first_name ?? ""} ${row.ownerSubscription?.owner?.last_name ?? ""}`.trim();
      } else {
        return `${row.memberSubscription?.member?.user?.first_name ?? ""} ${row.memberSubscription?.member?.user?.last_name ?? ""}`.trim();
      }
    },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
    cell: ({ row }) => {
      const payment = row.original;
      if (payment.subscription_type === "OWNER") {
        const owner = payment.ownerSubscription?.owner;
        return (
          <div className="flex flex-col">
            <span className="font-medium">
              {owner ? `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim() : "-"}
            </span>
            <span className="text-xs text-muted-foreground">{owner?.email ?? ""}</span>
            <span className="text-xs text-muted-foreground">Owner Subscription</span>
          </div>
        );
      } else {
        const member = payment.memberSubscription?.member?.user;
        return (
          <div className="flex flex-col">
            <span className="font-medium">
              {member ? `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() : "-"}
            </span>
            <span className="text-xs text-muted-foreground">{member?.email ?? ""}</span>
            <span className="text-xs text-muted-foreground">Member Subscription</span>
          </div>
        );
      }
    },
  },
  {
    accessorKey: "amount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => formatCurrency(row.original.amount),
  },
  {
    accessorKey: "payment_method",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Payment Method" />,
    cell: ({ row }) => {
      const method = row.original.payment_method;
      return method === "CASH" ? "Cash" : method === "BANK_TRANSFER" ? "Bank Transfer" : method;
    },
  },
  {
    accessorKey: "payment_date",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Payment Date" />,
    cell: ({ row }) => formatDate(row.original.payment_date),
  },
  {
    accessorKey: "transaction_id",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Transaction ID" />,
    cell: ({ row }) => row.original.transaction_id || "-",
  },
  {
    accessorKey: "subscription_type",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    cell: ({ row }) => row.original.subscription_type,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <ActionCell payment={row.original} />,
  },
];

const ActionCell = ({ payment }: { payment: Payment }) => {
  const handleGenerateInvoice = async () => {
    try {
      const response = await axios.post(
        "/api/payments/generateinvoice",
        { payment_id: payment.id },
        { responseType: "blob" }
      );
      
      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `invoice-${payment.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("Invoice generated successfully");
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || "Failed to generate invoice";
      toast.error(errorMessage);
    }
  };

  // Only show invoice button for owner subscription payments
  if (payment.subscription_type !== "OWNER") {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  return (
    <div className="flex gap-2">
      <Button
        size="icon"
        variant="outline"
        onClick={handleGenerateInvoice}
        className="rounded text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        title="Generate Invoice"
      >
        <FileTextIcon size={16} />
      </Button>
    </div>
  );
};

