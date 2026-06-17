"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RenewMemberModalProps {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  defaultPrice: number;
  defaultBillingModel: string;
}

export default function RenewMemberModal({
  open,
  onClose,
  memberId,
  memberName,
  defaultPrice,
  defaultBillingModel,
}: RenewMemberModalProps) {
  const queryClient = useQueryClient();

  const [price, setPrice] = useState(defaultPrice);
  const [months, setMonths] = useState(
    defaultBillingModel === "YEARLY" ? 12 : 1
  );
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK_TRANSFER">(
    "CASH"
  );
  const [transactionId, setTransactionId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (paymentMethod === "BANK_TRANSFER" && !transactionId.trim()) {
      toast.error("Transaction ID is required for bank transfer");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        "/api/membersubscriptions/renewmembersubscription-owner",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            member_id: memberId,
            price,
            months,
            use_custom_dates: false,
            payment_method: paymentMethod,
            transaction_id: transactionId || undefined,
            notes: notes || undefined,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to renew");
      }

      toast.success(`${memberName}'s membership renewed successfully`);

      queryClient.invalidateQueries({ queryKey: ["ownerDashboardOverview"] });

      handleClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setPrice(defaultPrice);
    setMonths(defaultBillingModel === "YEARLY" ? 12 : 1);
    setPaymentMethod("CASH");
    setTransactionId("");
    setNotes("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renew — {memberName}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="price">Amount (PKR)</Label>
            <Input
              id="price"
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="months">Duration (months)</Label>
            <Input
              id="months"
              type="number"
              min={1}
              max={24}
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Payment Method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(v) =>
                setPaymentMethod(v as "CASH" | "BANK_TRANSFER")
              }
            >
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
              <Label htmlFor="txn">Transaction ID</Label>
              <Input
                id="txn"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="Bank reference number"
              />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Processing..." : "Confirm & Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
