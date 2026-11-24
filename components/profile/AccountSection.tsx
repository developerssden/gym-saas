"use client";

import { useState } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";

import { LabeledField } from "@/components/forms/labeled-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { accountErrors, accountPayload, type AccountValues } from "@/lib/profile";
import { cn } from "@/lib/utils";

const OPTIONAL_KEYS = ["date_of_birth", "cnic", "address", "city", "state", "zip_code", "country"] as const;

export function AccountSection({ email, initial }: { email: string | null; initial: AccountValues }) {
  const { data: session, update: updateSession } = useSession();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<AccountValues>(initial);
  const [saved, setSaved] = useState<AccountValues>(initial);
  const [submitted, setSubmitted] = useState(false);
  // Open the optional part straight away if any of it is filled in.
  const [moreOpen, setMoreOpen] = useState(OPTIONAL_KEYS.some(k => !!initial[k]));

  const errors = accountErrors(values);
  const show = (e?: string) => (submitted ? e : undefined);
  const dirty = (Object.keys(values) as (keyof AccountValues)[]).some(k => values[k] !== saved[k]);
  const set = (field: keyof AccountValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues(v => ({ ...v, [field]: e.target.value }));

  const save = useMutation({
    mutationFn: () => axios.post("/api/profile/updateprofile", accountPayload(values)),
    onSuccess: async res => {
      toast.success("Your details are saved");
      setSaved(values);
      setSubmitted(false);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      await updateSession({ user: { ...session?.user, ...res.data.data } });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) {
      if (errors.date_of_birth) setMoreOpen(true);
      return;
    }
    save.mutate();
  };

  return (
    <Card id="account" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Your name and phone number. Only these two are required.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <LabeledField label="Email" hint="You sign in with this. It can't be changed here.">
            {p => <Input {...p} type="email" value={email ?? ""} readOnly disabled className="h-11 bg-muted" />}
          </LabeledField>

          <div className="grid gap-4 sm:grid-cols-2">
            <LabeledField label="First name" required error={show(errors.first_name)}>
              {p => <Input {...p} autoComplete="given-name" value={values.first_name} onChange={set("first_name")} className="h-11" />}
            </LabeledField>
            <LabeledField label="Last name">
              {p => <Input {...p} autoComplete="family-name" value={values.last_name} onChange={set("last_name")} className="h-11" />}
            </LabeledField>
          </div>

          <LabeledField label="Phone" required error={show(errors.phone_number)}>
            {p => (
              <Input
                {...p}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="e.g. 0301 2345678"
                value={values.phone_number}
                onChange={set("phone_number")}
                className="h-11"
              />
            )}
          </LabeledField>

          <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="h-11 w-full justify-between px-2 md:h-9">
                Address and other details (optional)
                <ChevronDown aria-hidden className={cn("transition-transform", moreOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="grid gap-4 pt-2 sm:grid-cols-2">
              <LabeledField label="Date of birth" error={show(errors.date_of_birth)}>
                {p => (
                  <Input
                    {...p}
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={values.date_of_birth}
                    onChange={set("date_of_birth")}
                    className="h-11"
                  />
                )}
              </LabeledField>
              <LabeledField label="CNIC">
                {p => <Input {...p} inputMode="numeric" value={values.cnic} onChange={set("cnic")} className="h-11" />}
              </LabeledField>
              <LabeledField label="Address" className="sm:col-span-2">
                {p => <Input {...p} autoComplete="street-address" value={values.address} onChange={set("address")} className="h-11" />}
              </LabeledField>
              <LabeledField label="City">
                {p => <Input {...p} autoComplete="address-level2" value={values.city} onChange={set("city")} className="h-11" />}
              </LabeledField>
              <LabeledField label="State / province">
                {p => <Input {...p} autoComplete="address-level1" value={values.state} onChange={set("state")} className="h-11" />}
              </LabeledField>
              <LabeledField label="Postcode">
                {p => <Input {...p} autoComplete="postal-code" value={values.zip_code} onChange={set("zip_code")} className="h-11" />}
              </LabeledField>
              <div className="grid gap-1.5">
                <span className="text-sm leading-none font-medium">Country</span>
                <CountryDropdown
                  placeholder="Choose a country"
                  defaultValue={values.country || undefined}
                  onChange={country => setValues(v => ({ ...v, country: country.alpha3 }))}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex justify-end">
            <Button type="submit" className="h-11 w-full sm:w-auto md:h-10" disabled={!dirty} loading={save.isPending}>
              Save details
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
