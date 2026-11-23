"use client";

// Equipment list: what it is, its condition, and when maintenance is due
// (overdue in red, due this week in amber). Edit is a button; Delete is under More.
import { useState } from "react";
import axios from "axios";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ListCard } from "@/components/common/list-card";
import { RowActions } from "@/components/common/row-actions";
import { useConfirm } from "@/components/common/confirm-dialog";
import EquipmentDialog, { invalidateEquipmentQueries, type EquipmentRow } from "@/components/equipment/EquipmentDialog";
import { usePermissions } from "@/hooks/usePermissions";
import {
  equipmentCategoryLabel,
  equipmentConditionLabel,
  equipmentStatusLabel,
  maintenanceState,
  maintenanceText,
} from "@/lib/equipment";
import { formatDate } from "@/lib/format";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { cn } from "@/lib/utils";

export type { EquipmentRow };

const chip = "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

/** Condition, or the status when it isn't in use (being repaired, retired). */
function ConditionBadge({ item }: { item: EquipmentRow }) {
  if (item.status !== "ACTIVE") {
    return <span className={cn(chip, "bg-muted text-muted-foreground")}>{equipmentStatusLabel(item.status)}</span>;
  }
  if (!item.condition) return null;
  return (
    <span
      className={cn(
        chip,
        item.condition === "OUT_OF_ORDER" && "bg-destructive/10 text-destructive",
        item.condition === "NEEDS_MAINTENANCE" && "bg-amber-500/15 text-amber-800 dark:text-amber-300",
        (item.condition === "NEW" || item.condition === "GOOD") && "bg-status-active text-status-active-foreground"
      )}
    >
      {equipmentConditionLabel(item.condition)}
    </span>
  );
}

/** "22 Nov 2026" plus "Overdue by 3 days" (red) or "Due in 2 days" (amber). */
function MaintenanceDue({ item, className }: { item: EquipmentRow; className?: string }) {
  if (!item.next_maintenance_due) return <span className={cn("text-muted-foreground", className)}>Not set</span>;
  const state = maintenanceState(item.next_maintenance_due, item.status);
  const note = maintenanceText(state);
  return (
    <span className={cn("flex flex-col", className)}>
      <span className={cn(state.kind === "overdue" && "font-medium text-destructive")}>{formatDate(item.next_maintenance_due)}</span>
      {note && (
        <span
          className={cn(
            "text-xs",
            state.kind === "overdue" ? "text-destructive" : "text-amber-800 dark:text-amber-300"
          )}
        >
          {note}
        </span>
      )}
    </span>
  );
}

const quantityText = (q: string) => (q && q !== "1" ? `× ${q}` : "");

export const columns: ColumnDef<EquipmentRow>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium">
          {row.original.name} <span className="font-normal text-muted-foreground">{quantityText(row.original.quantity)}</span>
        </span>
        {row.original.brand && <span className="text-xs text-muted-foreground">{row.original.brand}</span>}
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => equipmentCategoryLabel(row.original.category) ?? <span className="text-muted-foreground">{row.original.type}</span>,
  },
  {
    id: "condition",
    header: "Condition",
    cell: ({ row }) => <ConditionBadge item={row.original} />,
  },
  {
    accessorKey: "next_maintenance_due",
    header: "Maintenance due",
    cell: ({ row }) => <MaintenanceDue item={row.original} />,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    enableHiding: false,
    cell: ({ row }) => <EquipmentActions item={row.original} className="justify-end" />,
  },
];

/** One item on a phone. */
export function EquipmentCard({ item }: { item: EquipmentRow }) {
  const state = maintenanceState(item.next_maintenance_due, item.status);
  const note = maintenanceText(state);
  return (
    <ListCard
      title={`${item.name} ${quantityText(item.quantity)}`.trim()}
      subtitle={equipmentCategoryLabel(item.category) ?? item.type}
      status={<ConditionBadge item={item} />}
      meta={
        item.next_maintenance_due ? (
          <span className={cn(state.kind === "overdue" && "font-medium text-destructive", state.kind === "soon" && "text-amber-800 dark:text-amber-300")}>
            Maintenance {formatDate(item.next_maintenance_due)}
            {note && ` · ${note}`}
          </span>
        ) : undefined
      }
      actions={<EquipmentActions item={item} />}
    />
  );
}

function EquipmentActions({ item, className }: { item: EquipmentRow; className?: string }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const canEdit = can("equipment.edit");
  const canDelete = can("equipment.delete");

  const remove = useMutation({
    mutationFn: () => axios.post("/api/equipment/deleteequipment", { id: item.id }),
    onSuccess: () => {
      toast.success(`Deleted ${item.name}`);
      invalidateEquipmentQueries(queryClient);
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const askDelete = async () => {
    const ok = await confirm({
      title: `Delete ${item.name}?`,
      description: "It's removed from your equipment list, with its maintenance dates and notes. This can't be undone.",
      confirmLabel: "Delete equipment",
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
        moreLabel={`More actions for ${item.name}`}
        actions={[
          { label: "Edit", icon: Pencil, onClick: () => setOpen(true), hidden: !canEdit },
          { label: "Details", icon: Eye, onClick: () => setOpen(true), hidden: canEdit },
          { label: "Delete", icon: Trash2, destructive: true, onClick: askDelete, hidden: !canDelete, loading: remove.isPending },
        ]}
      />
      <EquipmentDialog open={open} onClose={() => setOpen(false)} equipment={item} readOnly={!canEdit} />
    </>
  );
}
