"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { toast } from "sonner";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateRegistration } from "@/hooks/use-registrations";
import { getErrorMessage } from "@/lib/getErrorMessage";
import type { GymRegistration } from "@/types";

const STATUS_LABELS: Record<GymRegistration["status"], string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  ONBOARDED: "Onboarded",
  CLOSED: "Closed",
};

const truncate = (value: string | null, max = 80) => {
  const s = value ?? "";
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
};

export const columns: ColumnDef<GymRegistration>[] = [
  {
    accessorKey: "createdAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm">
        {format(new Date(row.original.createdAt), "d MMM yyyy, h:mm a")}
      </span>
    ),
  },
  {
    accessorKey: "owner_name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Owner" />,
    cell: ({ row }) => <span className="font-medium">{row.original.owner_name}</span>,
  },
  {
    accessorKey: "gym_name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Gym" />,
  },
  {
    accessorKey: "city",
    header: ({ column }) => <DataTableColumnHeader column={column} title="City" />,
  },
  {
    accessorKey: "member_count",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Members" />,
    cell: ({ row }) => row.original.member_count || <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "phone",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
    cell: ({ row }) => <PhoneCell phone={row.original.phone} />,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => <StatusCell registration={row.original} />,
  },
  {
    accessorKey: "message",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Message" />,
    cell: ({ row }) =>
      row.original.message ? (
        <span className="text-sm text-muted-foreground" title={row.original.message}>
          {truncate(row.original.message)}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
];

const PhoneCell = ({ phone }: { phone: string }) => (
  <div className="flex flex-col gap-0.5 whitespace-nowrap">
    <a href={`tel:${phone}`} className="text-sm hover:underline">
      {phone}
    </a>
    <a
      href={`https://wa.me/${phone.replace(/\D/g, "")}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs font-semibold text-primary-dim hover:underline"
    >
      Open in WhatsApp ↗
    </a>
  </div>
);

const StatusCell = ({ registration }: { registration: GymRegistration }) => {
  const { mutate, isPending } = useUpdateRegistration();

  return (
    <Select
      value={registration.status}
      disabled={isPending}
      onValueChange={(value) =>
        mutate(
          { id: registration.id, status: value as GymRegistration["status"] },
          {
            onSuccess: () => toast.success(`Marked as ${STATUS_LABELS[value as GymRegistration["status"]]}`),
            onError: (error) => toast.error(getErrorMessage(error) || "Failed to update status"),
          }
        )
      }
    >
      <SelectTrigger className="h-8 w-[130px]" aria-label={`Status for ${registration.gym_name}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(STATUS_LABELS) as GymRegistration["status"][]).map((status) => (
          <SelectItem key={status} value={status}>
            {STATUS_LABELS[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
