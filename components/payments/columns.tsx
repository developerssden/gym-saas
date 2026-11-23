"use client";

// The payments list as gym owners and staff see it: member, amount, method,
// date, who recorded it, and the receipt buttons in view (not in a menu).
import type { ColumnDef } from "@tanstack/react-table";
import type { Payment } from "@/types";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { CurrencyAmount } from "@/components/common/CurrencyAmount";
import { ListCard } from "@/components/common/list-card";
import { ReceiptDownloadButton, ShareReceiptButton } from "@/components/common/whatsapp-actions";
import { usePermissions } from "@/hooks/usePermissions";
import { resolveGymCountry } from "@/lib/currency";
import { formatDate, paymentMethodLabel } from "@/lib/format";
import { recordedByLabel } from "@/lib/recorded-by";
import { cn } from "@/lib/utils";

const memberOf = (p: Payment) => p.memberSubscription?.member;

export const paymentMemberName = (p: Payment) => {
  const user = memberOf(p)?.user;
  return `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() || "Member";
};

const countryOf = (p: Payment) => {
  const member = memberOf(p) as { gym?: { country?: string | null }; location?: { country?: string | null } } | undefined;
  return resolveGymCountry(member?.gym?.country, member?.location?.country);
};

const methodText = (p: Payment) =>
  p.payment_method === "BANK_TRANSFER" && p.transaction_id
    ? `${paymentMethodLabel(p.payment_method)} · ${p.transaction_id}`
    : paymentMethodLabel(p.payment_method);

export const paymentMemberHref = (p: Payment) => {
  const id = memberOf(p)?.id;
  return id ? `/members/${id}` : undefined;
};

/** Receipt (PDF) and WhatsApp, as buttons. */
function ReceiptActions({ payment, className }: { payment: Payment; className?: string }) {
  const { can } = usePermissions();
  const member = memberOf(payment);
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <ReceiptDownloadButton paymentId={payment.id} className="h-11 md:h-8" />
      {member && can("membersubscriptions.whatsapp") && (
        <ShareReceiptButton
          label="WhatsApp"
          variant="outline"
          size="sm"
          className="h-11 md:h-8"
          paymentId={payment.id}
          memberName={paymentMemberName(payment)}
          phone={member.user?.phone_number}
          gymName={member.gym?.name}
          gymCountry={countryOf(payment)}
          amount={payment.amount}
          paymentDate={payment.payment_date}
        />
      )}
    </div>
  );
}

export const columns: ColumnDef<Payment>[] = [
  {
    id: "member",
    accessorFn: paymentMemberName,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Member" />,
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium">{paymentMemberName(row.original)}</span>
        {memberOf(row.original)?.user?.phone_number && (
          <span className="text-xs text-muted-foreground">{memberOf(row.original)?.user?.phone_number}</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "amount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => (
      <CurrencyAmount amount={row.original.amount} countryCode={countryOf(row.original)} className="font-medium" />
    ),
  },
  {
    accessorKey: "payment_method",
    header: "Paid by",
    cell: ({ row }) => methodText(row.original),
  },
  {
    accessorKey: "payment_date",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
    cell: ({ row }) => formatDate(row.original.payment_date, "-"),
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
    cell: ({ row }) => <ReceiptActions payment={row.original} className="justify-end" />,
  },
];

/** A payment on a phone. Tapping it opens the member. */
export function PaymentCard({ payment }: { payment: Payment }) {
  return (
    <ListCard
      href={paymentMemberHref(payment)}
      title={paymentMemberName(payment)}
      subtitle={`${methodText(payment)} · ${formatDate(payment.payment_date, "-")}`}
      value={<CurrencyAmount amount={payment.amount} countryCode={countryOf(payment)} />}
      meta={`Recorded by ${recordedByLabel(payment.recordedBy)}`}
      actions={<ReceiptActions payment={payment} />}
    />
  );
}
