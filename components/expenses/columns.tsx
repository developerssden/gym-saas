"use client";

import { useState } from "react";
import axios from "axios";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CurrencyAmount } from "@/components/common/CurrencyAmount";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ListCard } from "@/components/common/list-card";
import { RowActions } from "@/components/common/row-actions";
import ExpenseDialog, { invalidateExpenseQueries, type ExpenseRow } from "@/components/expenses/ExpenseDialog";
import { expenseCategoryLabel } from "@/lib/expenses";
import { formatDate } from "@/lib/format";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { usePermissions } from "@/hooks/usePermissions";

export const columns: ColumnDef<ExpenseRow>[] = [
  {
    accessorKey: "expense_date",
    header: "Date",
    cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.expense_date)}</span>,
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => expenseCategoryLabel(row.original.category),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => <CurrencyAmount amount={row.original.amount} className="font-semibold" />,
  },
  {
    id: "location",
    header: "Location",
    cell: ({ row }) => row.original.location?.name ?? <span className="text-muted-foreground">All</span>,
  },
  {
    accessorKey: "note",
    header: "Note",
    cell: ({ row }) =>
      row.original.note ? (
        <span className="text-sm text-muted-foreground">{row.original.note}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    enableHiding: false,
    cell: ({ row }) => <ExpenseActions expense={row.original} />,
  },
];

/** Phone layout for one expense. */
export function ExpenseCard({ expense }: { expense: ExpenseRow }) {
  return (
    <ListCard
      title={expenseCategoryLabel(expense.category)}
      subtitle={formatDate(expense.expense_date)}
      value={<CurrencyAmount amount={expense.amount} />}
      meta={[expense.location?.name, expense.note].filter(Boolean).join(" · ") || undefined}
      actions={<ExpenseActions expense={expense} className="justify-start" />}
    />
  );
}

function ExpenseActions({ expense, className }: { expense: ExpenseRow; className?: string }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const remove = useMutation({
    mutationFn: () => axios.post("/api/expenses/deleteexpense", { id: expense.id }),
    onSuccess: () => {
      toast.success(`Deleted ${expenseCategoryLabel(expense.category)} expense from ${formatDate(expense.expense_date)}`);
      invalidateExpenseQueries(queryClient);
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const canEdit = can("expenses.edit");
  const canDelete = can("expenses.delete");
  if (!canEdit && !canDelete) return null;

  return (
    <>
      <RowActions
        className={className}
        visible={1}
        moreLabel={`More actions for ${expenseCategoryLabel(expense.category)} on ${formatDate(expense.expense_date)}`}
        actions={[
          { label: "Edit", icon: Pencil, onClick: () => setEditing(true), hidden: !canEdit },
          { label: "Delete", icon: Trash2, destructive: true, onClick: () => setConfirmDelete(true), hidden: !canDelete },
        ]}
      />

      <ExpenseDialog open={editing} onClose={() => setEditing(false)} expense={expense} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this expense?"
        description={`${expenseCategoryLabel(expense.category)} · ${formatDate(expense.expense_date)}. It will no longer count towards your expenses or profit.`}
        confirmLabel="Delete expense"
        destructive
        onConfirm={() => remove.mutateAsync()}
      />
    </>
  );
}
