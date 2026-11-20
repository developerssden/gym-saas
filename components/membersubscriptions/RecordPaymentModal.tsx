"use client";

import { useState } from "react";
import axios from "axios";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import { getErrorMessage } from "@/lib/getErrorMessage";

type RecordPaymentModalProps = {
  open: boolean;
  onClose: () => void;
  subscriptionId: string;
  memberName: string;
  /** What's still owed; the amount defaults to this. */
  balance: number;
};

/** Collect (part of) the remaining balance on a member subscription. */
export default function RecordPaymentModal(props: RecordPaymentModalProps) {
  // Remount the form each time it opens so it starts from the current balance.
  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="sm:max-w-md">
        {props.open && <RecordPaymentForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentForm({ onClose, subscriptionId, memberName, balance }: RecordPaymentModalProps) {
  const queryClient = useQueryClient();
  const { currencyCode, format } = useGymCurrency();
  const [amount, setAmount] = useState(String(balance));
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [transactionId, setTransactionId] = useState("");
  const [notes, setNotes] = useState("");

  const value = Number(amount);
  const amountError =
    !amount.trim() || !Number.isInteger(value) || value <= 0
      ? "Enter a whole amount greater than 0"
      : value > balance
        ? `Can't be more than the balance (${format(balance)})`
        : null;

  const mutation = useMutation({
    mutationFn: () =>
      axios.post("/api/payments/createpayment", {
        subscription_type: "MEMBER",
        member_subscription_id: subscriptionId,
        amount: value,
        payment_method: paymentMethod,
        transaction_id: transactionId.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      const left = balance - value;
      toast.success(
        left > 0
          ? `Payment recorded. ${memberName} still owes ${format(left)}.`
          : `Payment recorded. ${memberName} has paid in full.`
      );
      queryClient.invalidateQueries({ queryKey: ["membersubscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["ownerDashboardOverview"] });
      onClose();
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const submit = () => {
    if (amountError) return;
    if (paymentMethod === "BANK_TRANSFER" && !transactionId.trim()) {
      toast.error("Transaction ID is required for bank transfer");
      return;
    }
    mutation.mutate();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>Record payment — {memberName}</DialogTitle>
        <DialogDescription>Balance due: {format(balance)}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <div className="grid gap-1.5">
          <Label htmlFor="record-amount">Amount ({currencyCode})</Label>
          <Input
            id="record-amount"
            type="number"
            inputMode="numeric"
            min={1}
            max={balance}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={!!amountError || undefined}
            aria-describedby={amountError ? "record-amount-error" : undefined}
          />
          {amountError && (
            <p id="record-amount-error" className="text-sm text-destructive">
              {amountError}
            </p>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label>Payment method</Label>
          <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "CASH" | "BANK_TRANSFER")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CASH">Cash</SelectItem>
              <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {paymentMethod === "BANK_TRANSFER" && (
          <div className="grid gap-1.5">
            <Label htmlFor="record-txn">Transaction ID</Label>
            <Input
              id="record-txn"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="Bank reference number"
            />
          </div>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="record-notes">Notes (optional)</Label>
          <Input
            id="record-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Second instalment"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending || !!amountError}>
          {mutation.isPending ? "Saving..." : "Record payment"}
        </Button>
      </DialogFooter>
    </form>
  );
}
