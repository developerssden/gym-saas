"use client";

import { useState } from "react";
import axios from "axios";
import { format as formatDateFns } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LabeledField } from "@/components/forms/labeled-field";
import { StickyFormFooter } from "@/components/forms/sticky-form-footer";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import { amountDue, validateFeeInput } from "@/lib/member-balance";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { PAYMENT_QUERY_KEYS } from "@/lib/payment-queries";
import { cn } from "@/lib/utils";

const LENGTHS = [
  { months: 1, label: "1 month" },
  { months: 3, label: "3 months" },
  { months: 6, label: "6 months" },
  { months: 12, label: "1 year" },
];

/** The fee last used for this length at this gym, so the next walk-in is one tap. */
const feeKey = (gymId: string, months: number) => `kettlio:last-fee:${gymId}:${months}`;
function readLastFee(gymId: string, months: number): string {
  try {
    return window.localStorage.getItem(feeKey(gymId, months)) ?? "";
  } catch {
    return "";
  }
}
function saveLastFee(gymId: string, months: number, price: number) {
  try {
    window.localStorage.setItem(feeKey(gymId, months), String(price));
  } catch {
    // Private mode or storage blocked: nothing to remember.
  }
}

export type MembershipSaved = {
  endDate: string;
  paid: number;
  due: number;
  method: "CASH" | "BANK_TRANSFER";
  paymentId: string | null;
};

type Props = {
  memberId: string;
  gymId: string;
  /** Show "Take fee now" (needs payments.record or membersubscriptions.renew). */
  canTakeFee: boolean;
  onSaved: (result: MembershipSaved) => void;
  onSkip: () => void;
};

/** Step 2 of adding a member: their membership and, optionally, the fee right now. */
export function NewMemberMembership({ memberId, gymId, canTakeFee, onSaved, onSkip }: Props) {
  const queryClient = useQueryClient();
  const { currencyCode, format } = useGymCurrency();
  const today = formatDateFns(new Date(), "yyyy-MM-dd");

  const [months, setMonths] = useState(1);
  const [price, setPrice] = useState(() => readLastFee(gymId, 1));
  const [admission, setAdmission] = useState("");
  const [start, setStart] = useState(today);
  const [payNow, setPayNow] = useState<"full" | "part" | "later">(canTakeFee ? "full" : "later");
  const [partAmount, setPartAmount] = useState("");
  const [method, setMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [transactionId, setTransactionId] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const priceNum = price.trim() ? Number(price) : NaN;
  const admissionNum = admission.trim() ? Number(admission) : 0;
  const due = Number.isFinite(priceNum) ? amountDue({ price: priceNum, admission_fee: admissionNum }) : 0;
  const paid = payNow === "full" ? due : payNow === "part" ? (partAmount.trim() ? Number(partAmount) : NaN) : 0;

  const priceError = !Number.isInteger(priceNum) || priceNum <= 0 ? "Enter the fee, e.g. 5000" : null;
  const admissionError = !Number.isInteger(admissionNum) || admissionNum < 0 ? "Whole number, or leave empty" : null;
  const startError = !start ? "Pick a start date" : null;
  const partError =
    payNow !== "part"
      ? null
      : !Number.isInteger(paid) || paid <= 0
        ? "Enter what they paid"
        : paid >= due
          ? "That's the full amount: choose Full"
          : null;
  const txnError = paid > 0 && method === "BANK_TRANSFER" && !transactionId.trim() ? "Add the transaction ID" : null;
  const feeError =
    priceError || admissionError ? null : validateFeeInput({ price: priceNum, discount: 0, admission_fee: admissionNum, amount_paid: paid });
  const hasErrors = !!(priceError || admissionError || startError || partError || txnError || feeError);
  const show = (e: string | null) => (submitted ? e : null);

  const chooseLength = (m: number) => {
    setMonths(m);
    const remembered = readLastFee(gymId, m);
    if (remembered) setPrice(remembered);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (hasErrors) return;
    setSaving(true);
    try {
      const res = await axios.post("/api/membersubscriptions/createmembersubscription-owner", {
        member_id: memberId,
        price: priceNum,
        admission_fee: admissionNum,
        months,
        use_custom_dates: false,
        start_date: start,
        amount_paid: paid,
        payment_method: method,
        transaction_id: method === "BANK_TRANSFER" ? transactionId.trim() : undefined,
      });
      saveLastFee(gymId, months, priceNum);
      for (const key of PAYMENT_QUERY_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
      onSaved({
        endDate: res.data?.data?.end_date,
        paid,
        due,
        method,
        paymentId: res.data?.payment_id ?? null,
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const chip = (selected: boolean) =>
    cn(
      "min-h-11 rounded-md border px-3 text-sm font-medium transition-colors md:min-h-9",
      selected ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
    );

  return (
    <form onSubmit={save} noValidate className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <section aria-labelledby="membership-heading" className="flex flex-col gap-4">
        <h2 id="membership-heading" className="font-heading text-lg font-semibold">
          Membership
        </h2>

        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Length</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {LENGTHS.map((l) => (
              <button key={l.months} type="button" aria-pressed={months === l.months} onClick={() => chooseLength(l.months)} className={chip(months === l.months)}>
                {l.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledField label={`Fee (${currencyCode})`} required error={show(priceError)}>
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                autoFocus
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 5000"
                className="h-12 text-lg"
              />
            )}
          </LabeledField>
          <LabeledField label="Starts" required error={show(startError)}>
            {(p) => <Input {...p} type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-12" />}
          </LabeledField>
        </div>

        <LabeledField label={`Admission fee (${currencyCode}, optional)`} hint="One-time joining fee, added to the first payment." error={show(admissionError)}>
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={admission}
              onChange={(e) => setAdmission(e.target.value)}
              placeholder="0"
              className="h-11"
            />
          )}
        </LabeledField>
      </section>

      {canTakeFee && (
        <section aria-labelledby="fee-heading" className="flex flex-col gap-4 rounded-lg border border-border p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="fee-heading" className="font-heading text-lg font-semibold">
              Take fee now
            </h2>
            {due > 0 && <span className="text-sm text-muted-foreground">Due {format(due)}</span>}
          </div>

          <fieldset className="grid gap-1.5">
            <legend className="sr-only">How much they pay now</legend>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" aria-pressed={payNow === "full"} onClick={() => setPayNow("full")} className={chip(payNow === "full")}>
                Full
              </button>
              <button type="button" aria-pressed={payNow === "part"} onClick={() => setPayNow("part")} className={chip(payNow === "part")}>
                Part
              </button>
              <button type="button" aria-pressed={payNow === "later"} onClick={() => setPayNow("later")} className={chip(payNow === "later")}>
                Later
              </button>
            </div>
          </fieldset>

          {payNow === "part" && (
            <LabeledField label={`Paid now (${currencyCode})`} required error={show(partError)} hint={due > 0 ? `The rest stays as a balance to collect.` : undefined}>
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={partAmount}
                  onChange={(e) => setPartAmount(e.target.value)}
                  className="h-11"
                />
              )}
            </LabeledField>
          )}

          {payNow !== "later" && (
            <>
              <ToggleGroup
                type="single"
                variant="outline"
                value={method}
                onValueChange={(v) => v && setMethod(v as "CASH" | "BANK_TRANSFER")}
                aria-label="Payment method"
                className="w-full"
              >
                <ToggleGroupItem value="CASH" className="h-11 flex-1">
                  Cash
                </ToggleGroupItem>
                <ToggleGroupItem value="BANK_TRANSFER" className="h-11 flex-1">
                  Bank transfer
                </ToggleGroupItem>
              </ToggleGroup>
              {method === "BANK_TRANSFER" && (
                <LabeledField label="Transaction ID" required error={show(txnError)}>
                  {(p) => <Input {...p} value={transactionId} onChange={(e) => setTransactionId(e.target.value)} className="h-11" />}
                </LabeledField>
              )}
            </>
          )}

          {submitted && feeError && (
            <p role="alert" className="text-sm text-destructive">
              {feeError}
            </p>
          )}
        </section>
      )}

      <StickyFormFooter>
        <Button type="button" variant="outline" onClick={onSkip} disabled={saving}>
          Skip for now
        </Button>
        <Button type="submit" loading={saving}>
          {paid > 0 && Number.isFinite(paid) ? `Save and take ${format(paid)}` : "Save membership"}
        </Button>
      </StickyFormFooter>
    </form>
  );
}
