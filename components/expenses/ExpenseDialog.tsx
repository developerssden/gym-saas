"use client";

import { useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/forms/form-dialog";
import { LabeledField } from "@/components/forms/labeled-field";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { cn } from "@/lib/utils";
import {
  EXPENSE_CATEGORIES,
  MAX_EXPENSE_NOTE,
  expenseCategoryLabel,
  isExpenseCategory,
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

/** Add or edit an expense: dialog on larger screens, bottom sheet on phones. */
export default function ExpenseDialog({ open, onClose, expense, gymId, locationId }: ExpenseDialogProps) {
  const queryClient = useQueryClient();
  const { currencyCode, format: formatMoney } = useGymCurrency();
  const isEdit = !!expense;
  const today = format(new Date(), "yyyy-MM-dd");

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategoryValue | "">("");
  const [day, setDay] = useState(today);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  // Reset the fields each time the dialog opens.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setAmount(expense ? String(expense.amount) : "");
      setCategory(expense?.category ?? "");
      setDay(expense ? format(new Date(expense.expense_date), "yyyy-MM-dd") : today);
      setNote(expense?.note ?? "");
      setSubmitted(false);
    }
  }

  const amountError = validateExpenseInput({
    amount: amount.trim() ? Number(amount) : NaN,
    category: EXPENSE_CATEGORIES[0].value,
  });
  const categoryError = isExpenseCategory(category) ? null : "Choose a category";
  const dayError = !day ? "Pick a date" : day > today ? "Can't be in the future" : null;
  const noteError = note.length > MAX_EXPENSE_NOTE ? `Keep the note under ${MAX_EXPENSE_NOTE} characters` : null;
  const hasErrors = !!(amountError || categoryError || dayError || noteError);
  const show = (error: string | null) => (submitted ? error : null);

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
      const what = `${formatMoney(Number(amount))} · ${expenseCategoryLabel(category)}`;
      toast.success(isEdit ? `Saved ${what}` : `Added ${what}`);
      invalidateExpenseQueries(queryClient);
      onClose();
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const submit = () => {
    setSubmitted(true);
    if (hasErrors) return;
    mutation.mutate();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={isEdit ? "Edit expense" : "Add expense"}
      description="Money the gym spent, e.g. rent, bills or salaries."
      onSubmit={submit}
      submitLabel={isEdit ? "Save changes" : "Add expense"}
      pending={mutation.isPending}
    >
      <LabeledField label={`Amount (${currencyCode})`} error={show(amountError)} required>
        {(p) => (
          <Input
            {...p}
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
        )}
      </LabeledField>

      <fieldset
        className="grid gap-1.5"
        aria-describedby={show(categoryError) ? "expense-category-error" : undefined}
        aria-invalid={show(categoryError) ? true : undefined}
      >
        <legend className="mb-1.5 text-sm font-medium">
          Category
          <span aria-hidden className="text-destructive">
            *
          </span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={category === c.value}
              onClick={() => setCategory(c.value)}
              className={cn(
                "min-h-11 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                category === c.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
              )}
            >
              {expenseCategoryLabel(c.value)}
            </button>
          ))}
        </div>
        {show(categoryError) && (
          <p id="expense-category-error" className="text-sm text-destructive">
            {categoryError}
          </p>
        )}
      </fieldset>

      <LabeledField label="Date" error={show(dayError)} required>
        {(p) => (
          <Input {...p} type="date" max={today} value={day} onChange={(e) => setDay(e.target.value)} className="h-11" />
        )}
      </LabeledField>

      <LabeledField label="Note (optional)" error={show(noteError)}>
        {(p) => (
          <Input
            {...p}
            maxLength={MAX_EXPENSE_NOTE}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. November electricity bill"
            className="h-11"
          />
        )}
      </LabeledField>
    </FormDialog>
  );
}
