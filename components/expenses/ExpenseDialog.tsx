"use client";

import { useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { cn } from "@/lib/utils";
import {
  EXPENSE_CATEGORIES,
  MAX_EXPENSE_NOTE,
  expenseCategoryLabel,
  validateExpenseInput,
  type ExpenseCategoryValue,
} from "@/lib/expenses";

export type ExpenseRow = {
  id: string;
  category: ExpenseCategoryValue;
  amount: number;
  expense_date: string;
  note: string | null;
  location?: { id: string; name: string } | null;
};

type ExpenseDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Edit this expense; omit to add a new one. */
  expense?: ExpenseRow | null;
  gymId?: string | null;
  locationId?: string | null;
};

export function invalidateExpenseQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["expenses"] });
  queryClient.invalidateQueries({ queryKey: ["cashbook"] });
  queryClient.invalidateQueries({ queryKey: ["ownerDashboardOverview"] });
}

export default function ExpenseDialog(props: ExpenseDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="sm:max-w-md">
        {props.open && <ExpenseForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function ExpenseForm({ onClose, expense, gymId, locationId }: ExpenseDialogProps) {
  const queryClient = useQueryClient();
  const { currencyCode, format: formatMoney } = useGymCurrency();
  const isEdit = !!expense;
  const today = format(new Date(), "yyyy-MM-dd");

  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [category, setCategory] = useState<ExpenseCategoryValue | "">(expense?.category ?? "");
  const [day, setDay] = useState(expense ? format(new Date(expense.expense_date), "yyyy-MM-dd") : today);
  const [note, setNote] = useState(expense?.note ?? "");
  const [submitted, setSubmitted] = useState(false);

  const error = validateExpenseInput({ amount: amount.trim() ? Number(amount) : NaN, category, note });
  const dayError = !day ? "Pick a date" : day > today ? "Can't be in the future" : null;

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? axios.post("/api/expenses/updateexpense", {
            id: expense!.id,
            amount: Number(amount),
            category,
            expense_date: day,
            note: note.trim() || null,
          })
        : axios.post("/api/expenses/createexpense", {
            gym_id: gymId,
            location_id: locationId || undefined,
            amount: Number(amount),
            category,
            expense_date: day,
            note: note.trim() || undefined,
          }),
    onSuccess: () => {
      toast.success(
        isEdit
          ? "Expense updated"
          : `Added ${formatMoney(Number(amount))} · ${expenseCategoryLabel(category)}`
      );
      invalidateExpenseQueries(queryClient);
      onClose();
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (error || dayError) return;
    mutation.mutate();
  };

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit expense" : "Add expense"}</DialogTitle>
        <DialogDescription>Money the gym spent, e.g. rent, bills or salaries.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <div className="grid gap-1.5">
          <Label htmlFor="expense-amount">Amount ({currencyCode})</Label>
          <Input
            id="expense-amount"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 45000"
            className="h-12 text-lg"
          />
        </div>

        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Category</legend>
          <div className="flex flex-wrap gap-2">
            {EXPENSE_CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-pressed={category === c.value}
                onClick={() => setCategory(c.value)}
                className={cn(
                  "min-h-10 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                  category === c.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                )}
              >
                {expenseCategoryLabel(c.value)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-1.5">
          <Label htmlFor="expense-date">Date</Label>
          <Input
            id="expense-date"
            type="date"
            max={today}
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="expense-note">Note (optional)</Label>
          <Input
            id="expense-note"
            maxLength={MAX_EXPENSE_NOTE}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. November electricity bill"
          />
        </div>

        {submitted && (error || dayError) && (
          <p role="alert" className="text-sm text-destructive">
            {error ?? dayError}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : isEdit ? "Save changes" : "Add expense"}
        </Button>
      </DialogFooter>
    </form>
  );
}
