"use client";

import { useState } from "react";
import axios from "axios";
import { format as formatDateFns } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LabeledField } from "@/components/forms/labeled-field";
import { StickyFormFooter } from "@/components/forms/sticky-form-footer";
import { FeeSummary } from "@/components/membersubscriptions/FeeSummary";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import { amountDue, validateFeeInput } from "@/lib/member-balance";
import { MEMBERSHIP_LENGTHS, readLastFee, saveLastFee } from "@/lib/fee-memory";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { PAYMENT_QUERY_KEYS } from "@/lib/payment-queries";
import { cn } from "@/lib/utils";

export type MembershipSaved = {
  endDate: string | null;
  paid: number;
  due: number;
  method: "CASH" | "BANK_TRANSFER";
  paymentId: string | null;
};

type Props = {
  memberId: string;
  gymId: string | null | undefined;
  /** "new": a member's first or next membership from a start date. "renew": continues from today, keeping days left. */
  mode: "new" | "renew";
  /** Show "Take fee now" (needs payments.record or membersubscriptions.renew). */
  canTakeFee: boolean;
  /** Renew: start from the member's last plan. */
  defaultMonths?: number;
  defaultPrice?: number;
  onSaved: (result: MembershipSaved) => void;
  onCancel: () => void;
  cancelLabel?: string;
  /** "page": sticky footer. "dialog": buttons at the end of the form. */
  layout?: "page" | "dialog";
};

const MAX_NOTE = 200;

/**
 * Length presets (with the fee last used for each), start date, discount and
 * admission fee, and the fee now with how it was paid. Every payment taken
 * here has a method, and a transaction ID for bank transfers.
 */
export function MembershipForm({
  memberId,
  gymId,
  mode,
  canTakeFee,
  defaultMonths = 1,
  defaultPrice,
  onSaved,
  onCancel,
  cancelLabel = "Cancel",
  layout = "page",
}: Props) {
  const queryClient = useQueryClient();
  const { currencyCode, format } = useGymCurrency();
  const today = formatDateFns(new Date(), "yyyy-MM-dd");
  const isPreset = MEMBERSHIP_LENGTHS.some((l) => l.months === defaultMonths);

  const [months, setMonths] = useState(isPreset ? defaultMonths : 1);
  const [price, setPrice] = useState(() => readLastFee(gymId, isPreset ? defaultMonths : 1) || (defaultPrice ? String(defaultPrice) : ""));
  const [admission, setAdmission] = useState("");
  const [discount, setDiscount] = useState("");
  const [discountNote, setDiscountNote] = useState("");
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [start, setStart] = useState(today);
  const [payNow, setPayNow] = useState<"full" | "part" | "later">(canTakeFee ? "full" : "later");
  const [partAmount, setPartAmount] = useState("");
  const [method, setMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [transactionId, setTransactionId] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const priceNum = price.trim() ? Number(price) : NaN;
  const admissionNum = admission.trim() ? Number(admission) : 0;
  const discountNum = discount.trim() ? Number(discount) : 0;
  const due = Number.isFinite(priceNum)
    ? amountDue({ price: priceNum, discount: discountNum, admission_fee: admissionNum })
    : 0;
  const paid = payNow === "full" ? due : payNow === "part" ? (partAmount.trim() ? Number(partAmount) : NaN) : 0;

  const priceError = !Number.isInteger(priceNum) || priceNum <= 0 ? "Enter the fee, e.g. 5000" : null;
  const admissionError = !Number.isInteger(admissionNum) || admissionNum < 0 ? "Whole number, or leave empty" : null;
  const discountError =
    !Number.isInteger(discountNum) || discountNum < 0
      ? "Whole number, or leave empty"
      : Number.isFinite(priceNum) && discountNum > priceNum
        ? "Can't be more than the fee"
        : null;
  const noteError = discountNote.length > MAX_NOTE ? `Keep it under ${MAX_NOTE} characters` : null;
  const startError = mode === "new" && !start ? "Pick a start date" : null;
  const partError =
    payNow !== "part"
      ? null
      : !Number.isInteger(paid) || paid <= 0
        ? "Enter what they paid"
        : paid >= due
          ? "That's the full amount: choose Full"
          : null;
  const txnError = paid > 0 && method === "BANK_TRANSFER" && !transactionId.trim() ? "Add the transaction ID" : null;
  const fieldErrors = priceError || admissionError || discountError;
  const feeError = fieldErrors
    ? null
    : validateFeeInput({ price: priceNum, discount: discountNum, admission_fee: admissionNum, amount_paid: Number.isFinite(paid) ? paid : 0 });
  const hasErrors = !!(fieldErrors || noteError || startError || partError || txnError || feeError);
  const show = (e: string | null) => (submitted ? e : null);

  const chooseLength = (m: number) => {
    setMonths(m);
    const remembered = readLastFee(gymId, m);
    if (remembered) setPrice(remembered);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSubmitted(true);
    if (hasErrors) {
      if (discountError || admissionError || noteError) setExtrasOpen(true);
      return;
    }
    setSaving(true);
    const body = {
      member_id: memberId,
      price: priceNum,
      discount: discountNum,
      discount_note: discountNum > 0 ? discountNote.trim() || undefined : undefined,
      admission_fee: admissionNum,
      months,
      use_custom_dates: false,
      amount_paid: paid,
      payment_method: method,
      transaction_id: method === "BANK_TRANSFER" ? transactionId.trim() : undefined,
    };
    try {
      const res =
        mode === "new"
          ? await axios.post("/api/membersubscriptions/createmembersubscription-owner", { ...body, start_date: start })
          : await axios.post("/api/membersubscriptions/renewmembersubscription-owner", {
              ...body,
              billing_model: months % 12 === 0 ? "YEARLY" : "MONTHLY",
            });
      saveLastFee(gymId, months, priceNum);
      for (const key of PAYMENT_QUERY_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
      onSaved({
        endDate: res.data?.data?.end_date ?? null,
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

  const buttons = (
    <>
      <Button type="button" variant="outline" onClick={onCancel} disabled={saving} className={layout === "dialog" ? "h-11 md:h-9" : undefined}>
        {cancelLabel}
      </Button>
      <Button type="submit" loading={saving} className={layout === "dialog" ? "h-11 md:h-9" : undefined}>
        {paid > 0 && Number.isFinite(paid)
          ? `${mode === "renew" ? "Renew" : "Save"} and take ${format(paid)}`
          : mode === "renew"
            ? "Renew"
            : "Save membership"}
      </Button>
    </>
  );

  return (
    <form onSubmit={save} noValidate className={cn("flex w-full flex-col gap-6", layout === "page" && "mx-auto max-w-xl")}>
      <section aria-label="Membership" className="flex flex-col gap-4">
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Length</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MEMBERSHIP_LENGTHS.map((l) => (
              <button key={l.months} type="button" aria-pressed={months === l.months} onClick={() => chooseLength(l.months)} className={chip(months === l.months)}>
                {l.label}
              </button>
            ))}
          </div>
          {mode === "renew" && (
            <p className="text-xs text-muted-foreground">Starts today. Any days left on their current membership are added on.</p>
          )}
        </fieldset>

        <div className={cn("grid gap-4", mode === "new" && "sm:grid-cols-2")}>
          <LabeledField label={`Fee (${currencyCode})`} required error={show(priceError)}>
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                autoFocus={layout === "page"}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 5000"
                className="h-12 text-lg"
              />
            )}
          </LabeledField>
          {mode === "new" && (
            <LabeledField label="Starts" required error={show(startError)}>
              {(p) => <Input {...p} type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-12" />}
            </LabeledField>
          )}
        </div>

        <Collapsible open={extrasOpen} onOpenChange={setExtrasOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" className="h-11 w-full justify-between px-2 md:h-9">
              Discount or admission fee (optional)
              <ChevronDown aria-hidden className={cn("transition-transform", extrasOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="grid gap-4 pt-2 sm:grid-cols-2">
            <LabeledField label={`Discount (${currencyCode})`} error={show(discountError)}>
              {(p) => (
                <Input {...p} type="number" inputMode="numeric" min={0} step={1} value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className="h-11" />
              )}
            </LabeledField>
            <LabeledField label={`Admission fee (${currencyCode})`} hint="One-time joining fee." error={show(admissionError)}>
              {(p) => (
                <Input {...p} type="number" inputMode="numeric" min={0} step={1} value={admission} onChange={(e) => setAdmission(e.target.value)} placeholder="0" className="h-11" />
              )}
            </LabeledField>
            {discountNum > 0 && (
              <LabeledField label="Discount reason" hint="e.g. Student, family, friend of owner" error={show(noteError)} className="sm:col-span-2">
                {(p) => <Input {...p} maxLength={MAX_NOTE} value={discountNote} onChange={(e) => setDiscountNote(e.target.value)} className="h-11" />}
              </LabeledField>
            )}
          </CollapsibleContent>
        </Collapsible>
      </section>

      {canTakeFee && (
        <section aria-labelledby="fee-heading" className="flex flex-col gap-4 rounded-lg border border-border p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="fee-heading" className="font-heading text-lg font-semibold">
              Take fee now
            </h2>
            {due > 0 && <span className="text-sm text-muted-foreground">Due {format(due)}</span>}
          </div>

          <fieldset>
            <legend className="sr-only">How much they pay now</legend>
            <div className="grid grid-cols-3 gap-2">
              {(["full", "part", "later"] as const).map((v) => (
                <button key={v} type="button" aria-pressed={payNow === v} onClick={() => setPayNow(v)} className={chip(payNow === v)}>
                  {v === "full" ? "Full" : v === "part" ? "Part" : "Later"}
                </button>
              ))}
            </div>
          </fieldset>

          {payNow === "part" && (
            <LabeledField label={`Paid now (${currencyCode})`} required error={show(partError)} hint="The rest stays as a balance to collect.">
              {(p) => (
                <Input {...p} type="number" inputMode="numeric" min={1} step={1} value={partAmount} onChange={(e) => setPartAmount(e.target.value)} className="h-11" />
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

          {Number.isFinite(paid) && due > 0 && <FeeSummary amountDue={due} amountPaid={paid} />}

          {submitted && feeError && (
            <p role="alert" className="text-sm text-destructive">
              {feeError}
            </p>
          )}
        </section>
      )}

      {layout === "page" ? (
        <StickyFormFooter>{buttons}</StickyFormFooter>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">{buttons}</div>
      )}
    </form>
  );
}
