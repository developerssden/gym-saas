"use client";

import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import type { Payment } from "@/types";
import { ColumnDef } from "@tanstack/react-table";
import { CurrencyAmount } from "@/components/common/CurrencyAmount";
import { resolveGymCountry } from "@/lib/currency";
import { ReceiptDownloadButton } from "@/components/common/whatsapp-actions";
import { recordedByLabel } from "@/lib/recorded-by";
import { formatDate as formatDisplayDate, paymentMethodLabel, subscriptionTypeLabel } from "@/lib/format";

const formatDate = (value: unknown) => formatDisplayDate(value as string | Date | null, "-");

function paymentCountryCode(payment: Payment): string | null {
  if (payment.subscription_type === "MEMBER") {
    const member = payment.memberSubscription?.member as
      | {
          gym?: { country?: string | null };
          location?: { country?: string | null };
        }
      | undefined;
    return resolveGymCountry(member?.gym?.country, member?.location?.country);
  }
  return (
    payment.ownerSubscription?.owner?.country?.trim() ||
    null
  );
}

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
            <span className="text-xs text-muted-foreground">{subscriptionTypeLabel("OWNER")}</span>
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
            <span className="text-xs text-muted-foreground">{subscriptionTypeLabel("MEMBER")}</span>
          </div>
        );
      }
    },
  },
  {
    accessorKey: "amount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => (
      <CurrencyAmount
        amount={row.original.amount}
        countryCode={paymentCountryCode(row.original)}
      />
    ),
  },
  {
    accessorKey: "payment_method",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Method" />,
    cell: ({ row }) => {
      const method = row.original.payment_method;
      return paymentMethodLabel(method);
    },
  },
  {
    accessorKey: "payment_date",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
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
    cell: ({ row }) => subscriptionTypeLabel(row.original.subscription_type),
  },
  {
    id: "recorded_by",
    header: "Recorded by",
    cell: ({ row }) => recordedByLabel(row.original.recordedBy),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Receipt</span>,
    enableHiding: false,
    cell: ({ row }) => <ActionCell payment={row.original} />,
  },
];

const ActionCell = ({ payment }: { payment: Payment }) => (
  <ReceiptDownloadButton paymentId={payment.id} className="h-8" />
);
