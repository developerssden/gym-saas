"use client";

// Add or edit a gym or one of its branches: name, phone, address and country
// (which sets the currency). Same fields and country picker for both.
import { useState } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FormDialog } from "@/components/forms/form-dialog";
import { LabeledField } from "@/components/forms/labeled-field";
import { Input } from "@/components/ui/input";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { PhoneInput } from "@/components/ui/phone-input";
import { getCurrencyCodeFromCountry } from "@/lib/currency";
import { getErrorMessage } from "@/lib/getErrorMessage";

export type Place = {
  id: string;
  name: string;
  phone_number?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  country?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  kind: "gym" | "branch";
  /** Edit this one; omit to add. */
  place?: Place | null;
  /** For a new branch: its gym, and the gym's country as the default. */
  gymId?: string;
  defaultCountry?: string | null;
  /** The plan's limit was reached. */
  onLimit?: () => void;
};

export function invalidatePlaces(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["gyms"] });
  queryClient.invalidateQueries({ queryKey: ["locations"] });
  queryClient.invalidateQueries({ queryKey: ["ownerDashboardOverview"] });
}

export function PlaceDialog({ open, onClose, kind, place, gymId, defaultCountry, onLimit }: Props) {
  const queryClient = useQueryClient();
  const { data: session, update } = useSession();
  const isEdit = !!place;
  const noun = kind === "gym" ? "gym" : "branch";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(place?.name ?? "");
      setPhone(place?.phone_number ?? "");
      setAddress(place?.address ?? "");
      setCity(place?.city ?? "");
      setProvince(place?.state ?? "");
      setPostcode(place?.zip_code ?? "");
      setCountry(place?.country ?? defaultCountry ?? "");
      setSubmitted(false);
    }
  }

  const nameError = name.trim() ? null : `Give the ${noun} a name`;

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        phone_number: phone || "",
        address: address.trim(),
        city: city.trim(),
        state: province.trim(),
        zip_code: postcode.trim(),
        country: country || "",
      };
      const url =
        kind === "gym"
          ? isEdit
            ? "/api/gyms/updategym"
            : "/api/gyms/creategym"
          : isEdit
            ? "/api/locations/updatelocation"
            : "/api/locations/createlocation";
      const payload = isEdit ? { id: place!.id, ...body } : kind === "branch" ? { gym_id: gymId, ...body } : body;
      return (await axios.post(url, payload)).data as { data?: { id?: string } };
    },
    onSuccess: async (res) => {
      toast.success(isEdit ? `Saved ${name.trim()}` : `Added ${name.trim()}`);
      invalidatePlaces(queryClient);
      // Refresh the gym and branch picker at the top of the page; pick the new
      // one when there was nothing to pick before.
      const newId = !isEdit ? res?.data?.id : undefined;
      const user = session?.user;
      await update({
        user: {
          ...user,
          ...(newId && kind === "gym" && !user?.selected_gym_id ? { selected_gym_id: newId } : {}),
          ...(newId && kind === "branch" && !user?.selected_location_id ? { selected_location_id: newId } : {}),
        },
      });
      onClose();
    },
    onError: (err: unknown) => {
      const data = axios.isAxiosError(err) ? (err.response?.data as { error?: string; message?: string }) : undefined;
      if (onLimit && (data?.error === "LIMIT_EXCEEDED" || /limit/i.test(data?.message ?? data?.error ?? ""))) {
        onClose();
        onLimit();
        return;
      }
      toast.error(getErrorMessage(err));
    },
  });

  const currency = country ? getCurrencyCodeFromCountry(country) : null;

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={isEdit ? `Edit ${noun}` : kind === "gym" ? "Add gym" : "Add branch"}
      description={kind === "gym" ? "Shown on receipts and reports." : "A place where members train, with its own members and equipment."}
      onSubmit={() => {
        setSubmitted(true);
        if (!nameError) save.mutate();
      }}
      submitLabel={isEdit ? "Save changes" : kind === "gym" ? "Add gym" : "Add branch"}
      pending={save.isPending}
    >
      <LabeledField label={kind === "gym" ? "Gym name" : "Branch name"} error={submitted ? nameError : null} required>
        {(p) => (
          <Input
            {...p}
            autoFocus={!isEdit}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === "gym" ? "e.g. Iron Fitness" : "e.g. Gulberg"}
            className="h-11"
          />
        )}
      </LabeledField>

      <LabeledField label="Phone">
        {(p) => <PhoneInput {...p} value={phone} onChange={(v) => setPhone(v ?? "")} defaultCountry="PK" className="h-11" />}
      </LabeledField>

      <LabeledField label="Address">
        {(p) => <Input {...p} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 12 Main Boulevard" className="h-11" />}
      </LabeledField>

      <div className="grid grid-cols-2 gap-3">
        <LabeledField label="City">
          {(p) => <Input {...p} value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Lahore" className="h-11" />}
        </LabeledField>
        <LabeledField label="Province">
          {(p) => <Input {...p} value={province} onChange={(e) => setProvince(e.target.value)} placeholder="e.g. Punjab" className="h-11" />}
        </LabeledField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <LabeledField label="Postcode">
          {(p) => <Input {...p} value={postcode} onChange={(e) => setPostcode(e.target.value)} className="h-11" />}
        </LabeledField>
        <LabeledField label="Country" hint={currency ? `Money is shown in ${currency}` : undefined}>
          {(p) => (
            <CountryDropdown
              id={p.id}
              aria-describedby={p["aria-describedby"]}
              placeholder="Choose country"
              defaultValue={country || undefined}
              onChange={(c) => setCountry(c.alpha3)}
            />
          )}
        </LabeledField>
      </div>
    </FormDialog>
  );
}
