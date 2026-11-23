"use client";

// Add, edit or look at a piece of equipment. The short form is name,
// category, quantity and condition; the rest is under "More details".
import { useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import { ChevronDown } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FormDialog } from "@/components/forms/form-dialog";
import { LabeledField } from "@/components/forms/labeled-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CONDITIONS,
  EQUIPMENT_STATUSES,
  defaultEquipmentType,
  equipmentCategoryLabel,
} from "@/lib/equipment";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { cn } from "@/lib/utils";

export type EquipmentRow = {
  id: string;
  name: string;
  type: string;
  category: string | null;
  quantity: string;
  condition: string | null;
  status: string;
  next_maintenance_due: string | null;
  last_maintenance_date: string | null;
  maintenance_notes: string | null;
  brand: string | null;
  weight: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  location: { id: string; name: string } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Edit (or view) this item; omit to add a new one. */
  equipment?: EquipmentRow | null;
  readOnly?: boolean;
  gymId?: string | null;
  locationId?: string | null;
  /** The plan's equipment limit was reached. */
  onLimit?: (info: { current?: number; max?: number }) => void;
};

const day = (value: string | null | undefined) => (value ? format(new Date(value), "yyyy-MM-dd") : "");

function Chips<T extends string>({
  legend,
  options,
  value,
  onChange,
  error,
  required,
}: {
  legend: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T | "";
  onChange: (v: T) => void;
  error?: string | null;
  required?: boolean;
}) {
  const id = `chips-${legend.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <fieldset className="grid gap-1.5" aria-describedby={error ? `${id}-error` : undefined} aria-invalid={error ? true : undefined}>
      <legend className="mb-1.5 text-sm font-medium">
        {legend}
        {required && (
          <span aria-hidden className="text-destructive">
            *
          </span>
        )}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60",
              value === o.value ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function invalidateEquipmentQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["equipment"] });
  queryClient.invalidateQueries({ queryKey: ["ownerDashboardOverview"] });
}

export default function EquipmentDialog({ open, onClose, equipment, readOnly = false, gymId, locationId, onLimit }: Props) {
  const queryClient = useQueryClient();
  const { currencyCode } = useGymCurrency();
  const isEdit = !!equipment;

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [condition, setCondition] = useState("GOOD");
  const [status, setStatus] = useState("ACTIVE");
  const [nextDue, setNextDue] = useState("");
  const [lastDone, setLastDone] = useState("");
  const [notes, setNotes] = useState("");
  const [brand, setBrand] = useState("");
  const [weight, setWeight] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  // Fill the fields each time it opens.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const e = equipment;
      setName(e?.name ?? "");
      setCategory(e?.category ?? "");
      setQuantity(e?.quantity ?? "1");
      setCondition(e?.condition ?? "GOOD");
      setStatus(e?.status ?? "ACTIVE");
      setNextDue(day(e?.next_maintenance_due));
      setLastDone(day(e?.last_maintenance_date));
      setNotes(e?.maintenance_notes ?? "");
      setBrand(e?.brand ?? "");
      setWeight(e?.weight ?? "");
      setPurchaseDate(day(e?.purchase_date));
      setPurchaseCost(e?.purchase_cost != null ? String(e.purchase_cost) : "");
      // Open "More details" when something in it is filled in.
      setMoreOpen(
        !!e &&
          (!!e.next_maintenance_due || !!e.last_maintenance_date || !!e.maintenance_notes || !!e.brand || !!e.weight ||
            !!e.purchase_date || e.purchase_cost != null || e.status !== "ACTIVE")
      );
      setSubmitted(false);
    }
  }

  const qty = Number(quantity);
  const nameError = name.trim() ? null : "Add a name, e.g. Treadmill";
  const categoryError = category ? null : "Choose a category";
  const quantityError = !quantity.trim() || !Number.isInteger(qty) || qty < 0 ? "Enter how many you have (0 or more)" : null;
  const costError = purchaseCost.trim() && !(Number(purchaseCost) >= 0) ? "Enter an amount, e.g. 150000" : null;
  const hasErrors = !!(nameError || categoryError || quantityError || costError);
  const show = (error: string | null) => (submitted ? error : null);

  const mutation = useMutation({
    mutationFn: () => {
      // Keep a custom type; one that was just the old category follows the new category.
      const keepType = isEdit && equipment!.type !== equipmentCategoryLabel(equipment!.category) ? equipment!.type : undefined;
      const body = {
        name: name.trim(),
        category,
        type: defaultEquipmentType(keepType, category),
        quantity: String(qty),
        condition,
        status,
        next_maintenance_due: nextDue ? new Date(nextDue).toISOString() : "",
        last_maintenance_date: lastDone ? new Date(lastDone).toISOString() : "",
        maintenance_notes: notes.trim(),
        brand: brand.trim(),
        weight: weight.trim(),
        purchase_date: purchaseDate ? new Date(purchaseDate).toISOString() : "",
        purchase_cost: purchaseCost.trim() ? Number(purchaseCost) : "",
      };
      return isEdit
        ? axios.post("/api/equipment/updateequipment", { id: equipment!.id, ...body })
        : axios.post("/api/equipment/createequipment", { ...body, gym_id: gymId, location_id: locationId || undefined });
    },
    onSuccess: () => {
      toast.success(isEdit ? `Saved ${name.trim()}` : `Added ${name.trim()}`);
      invalidateEquipmentQueries(queryClient);
      onClose();
    },
    onError: (err: unknown) => {
      const data = axios.isAxiosError(err) ? (err.response?.data as { limitExceeded?: boolean; current?: number; max?: number }) : undefined;
      if (data?.limitExceeded && onLimit) {
        onClose();
        onLimit({ current: data.current, max: data.max });
        return;
      }
      toast.error(getErrorMessage(err));
    },
  });

  const submit = () => {
    setSubmitted(true);
    if (hasErrors) {
      // An error may be inside "More details".
      if (costError) setMoreOpen(true);
      return;
    }
    mutation.mutate();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={readOnly ? equipment?.name ?? "Equipment" : isEdit ? "Edit equipment" : "Add equipment"}
      description={readOnly ? undefined : "A machine or item at this branch."}
      onSubmit={submit}
      submitLabel={isEdit ? "Save changes" : "Add equipment"}
      pending={mutation.isPending}
      readOnly={readOnly}
    >
      <fieldset disabled={readOnly} className="grid gap-4">
        <LabeledField label="Name" error={show(nameError)} required>
          {(p) => (
            <Input {...p} autoFocus={!isEdit} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Treadmill" className="h-11" />
          )}
        </LabeledField>

        <Chips legend="Category" options={EQUIPMENT_CATEGORIES} value={category} onChange={setCategory} error={show(categoryError)} required />

        <LabeledField label="How many" error={show(quantityError)} required>
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-11 w-32"
            />
          )}
        </LabeledField>

        <Chips legend="Condition" options={EQUIPMENT_CONDITIONS} value={condition} onChange={setCondition} />
      </fieldset>

      {/* Outside the fieldsets so it still opens when only looking. */}
      <button
        type="button"
        aria-expanded={moreOpen}
        aria-controls="equipment-more"
        onClick={() => setMoreOpen((o) => !o)}
        className="-mx-2 flex min-h-11 items-center justify-between rounded-md px-2 text-left text-sm font-medium hover:bg-muted"
      >
        More details: maintenance, brand, purchase
        <ChevronDown aria-hidden className={cn("size-4 transition-transform", moreOpen && "rotate-180")} />
      </button>

      {moreOpen && (
        <fieldset id="equipment-more" disabled={readOnly} className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <LabeledField label="Next maintenance">
                {(p) => <Input {...p} type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} className="h-11" />}
              </LabeledField>
              <LabeledField label="Last maintenance">
                {(p) => <Input {...p} type="date" value={lastDone} onChange={(e) => setLastDone(e.target.value)} className="h-11" />}
              </LabeledField>
            </div>
            <LabeledField label="Maintenance notes">
              {(p) => (
                <Textarea {...p} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Belt replaced, oil every 3 months" />
              )}
            </LabeledField>
            <Chips legend="Status" options={EQUIPMENT_STATUSES} value={status} onChange={setStatus} />
            <div className="grid grid-cols-2 gap-3">
              <LabeledField label="Brand">
                {(p) => <Input {...p} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Life Fitness" className="h-11" />}
              </LabeledField>
              <LabeledField label="Weight">
                {(p) => <Input {...p} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 20 kg" className="h-11" />}
              </LabeledField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <LabeledField label="Bought on">
                {(p) => <Input {...p} type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="h-11" />}
              </LabeledField>
              <LabeledField label={`Cost (${currencyCode})`} error={show(costError)}>
                {(p) => (
                  <Input
                    {...p}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={purchaseCost}
                    onChange={(e) => setPurchaseCost(e.target.value)}
                    placeholder="e.g. 150000"
                    className="h-11"
                  />
                )}
              </LabeledField>
            </div>
        </fieldset>
      )}
    </FormDialog>
  );
}
