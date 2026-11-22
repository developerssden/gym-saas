"use client";

import { useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/alert-dialog";
import { CurrencyAmount } from "@/components/common/CurrencyAmount";
import ExpenseDialog, { invalidateExpenseQueries, type ExpenseRow } from "@/components/expenses/ExpenseDialog";
import { expenseCategoryLabel } from "@/lib/expenses";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { usePermissions } from "@/hooks/usePermissions";

export const columns: ColumnDef<ExpenseRow>[] = [
  {
    accessorKey: "expense_date",
    header: "Date",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">{format(new Date(row.original.expense_date), "d MMM yyyy")}</span>
    ),
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
    header: "",
    enableHiding: false,
    cell: ({ row }) => <ExpenseActions expense={row.original} />,
  },
];

function ExpenseActions({ expense }: { expense: ExpenseRow }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const remove = useMutation({
    mutationFn: () => axios.post("/api/expenses/deleteexpense", { id: expense.id }),
    onSuccess: () => {
      toast.success("Expense deleted");
      invalidateExpenseQueries(queryClient);
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const canEdit = can("expenses.edit");
  const canDelete = can("expenses.delete");
  if (!canEdit && !canDelete) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && (
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ExpenseDialog open={editing} onClose={() => setEditing(false)} expense={expense} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {expenseCategoryLabel(expense.category)} · {format(new Date(expense.expense_date), "d MMM yyyy")}. It will no
              longer count towards your expenses or profit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
