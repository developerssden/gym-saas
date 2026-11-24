"use client";

import { useState } from "react";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { LabeledField } from "@/components/forms/labeled-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { PASSWORD_MIN_LENGTH, passwordErrors, type PasswordValues } from "@/lib/profile";

const EMPTY: PasswordValues = { current_password: "", new_password: "", confirm_password: "" };

export function PasswordSection() {
  const [values, setValues] = useState<PasswordValues>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const errors = passwordErrors(values);
  const show = (e?: string) => (submitted ? e : undefined);
  const set = (field: keyof PasswordValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues(v => ({ ...v, [field]: e.target.value }));

  const save = useMutation({
    mutationFn: () =>
      axios.post("/api/profile/updatepassword", {
        current_password: values.current_password,
        new_password: values.new_password,
      }),
    onSuccess: () => {
      toast.success("Password changed. Use the new one next time you sign in.");
      setValues(EMPTY);
      setSubmitted(false);
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length === 0) save.mutate();
  };

  return (
    <Card id="password" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>You stay signed in on this device after changing it.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <LabeledField label="Current password" required error={show(errors.current_password)}>
            {p => (
              <PasswordInput
                {...p}
                autoComplete="current-password"
                value={values.current_password}
                onChange={set("current_password")}
                className="h-11"
              />
            )}
          </LabeledField>
          <div className="grid gap-4 sm:grid-cols-2">
            <LabeledField
              label="New password"
              required
              hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
              error={show(errors.new_password)}
            >
              {p => (
                <PasswordInput {...p} autoComplete="new-password" value={values.new_password} onChange={set("new_password")} className="h-11" />
              )}
            </LabeledField>
            <LabeledField label="New password again" required error={show(errors.confirm_password)}>
              {p => (
                <PasswordInput
                  {...p}
                  autoComplete="new-password"
                  value={values.confirm_password}
                  onChange={set("confirm_password")}
                  className="h-11"
                />
              )}
            </LabeledField>
          </div>
          <div className="flex justify-end">
            <Button type="submit" className="h-11 w-full sm:w-auto md:h-10" loading={save.isPending}>
              Change password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
