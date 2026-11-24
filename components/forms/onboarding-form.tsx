"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import axios from "axios";

import { AuthHeading, authButton, authInput, authLink } from "@/components/auth/auth-shell";
import { LabeledField } from "@/components/forms/labeled-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { APP_NAME } from "@/constants/brand";
import { onboardingErrors, type OnboardingValues } from "@/lib/onboarding";
import { PASSWORD_MIN_LENGTH } from "@/lib/profile";

const EMPTY: OnboardingValues = { first_name: "", last_name: "", phone_number: "", password: "", confirm_password: "" };

export function OnboardingForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const email = searchParams?.get("email") ?? "";
  const token = searchParams?.get("token") ?? "";
  const isStaff = searchParams?.get("kind") === "staff";

  const [values, setValues] = useState<OnboardingValues>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!email || !token) {
    return (
      <div className="w-full max-w-[420px]">
        <AuthHeading title="This invite link isn't complete">
          Open the link from your invite email again, or ask the person who invited you to send a new one.
        </AuthHeading>
        <Link href="/sign-in" className={authLink}>
          Go to sign in
        </Link>
      </div>
    );
  }

  const errors = onboardingErrors(values);
  const show = (e?: string) => (submitted ? e : undefined);
  const set = (field: keyof OnboardingValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues(v => ({ ...v, [field]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setError("");
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      await axios.post("/api/clients/complete-invite", {
        token,
        email,
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        phone_number: values.phone_number,
        password: values.password,
      });
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Something went wrong. Please try again."
      );
      setLoading(false);
      return;
    }

    // Account is ready: sign them straight in and open the dashboard (owners see the setup checklist there).
    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password: values.password,
      remember: "true",
      redirect: false,
    });
    if (result && !result.error) {
      router.push("/dashboard");
      router.refresh();
    } else {
      router.push("/sign-in");
    }
  };

  return (
    <div className="w-full max-w-[420px]">
      <AuthHeading title={isStaff ? "Set up your staff account" : `Welcome to ${APP_NAME}`}>
        {isStaff
          ? "Three quick things and you're in."
          : "Your name, phone and a password. You can add your gym and members straight after."}
      </AuthHeading>

      <form onSubmit={submit} noValidate className="space-y-5">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <LabeledField label="Email" hint="You'll sign in with this.">
          {p => <Input {...p} type="email" value={email} readOnly disabled className={authInput} />}
        </LabeledField>

        <div className="grid gap-5 sm:grid-cols-2">
          <LabeledField label="First name" required error={show(errors.first_name)}>
            {p => (
              <Input
                {...p}
                autoComplete="given-name"
                autoFocus
                value={values.first_name}
                onChange={set("first_name")}
                disabled={loading}
                className={authInput}
              />
            )}
          </LabeledField>
          <LabeledField label="Last name">
            {p => (
              <Input
                {...p}
                autoComplete="family-name"
                value={values.last_name}
                onChange={set("last_name")}
                disabled={loading}
                className={authInput}
              />
            )}
          </LabeledField>
        </div>

        <LabeledField
          label="Phone"
          required
          hint={isStaff ? undefined : "For your account; members never see it."}
          error={show(errors.phone_number)}
        >
          {p => (
            <PhoneInput
              {...p}
              value={values.phone_number}
              onChange={value => setValues(v => ({ ...v, phone_number: value ?? "" }))}
              defaultCountry="PK"
              international
              disabled={loading}
            />
          )}
        </LabeledField>

        <LabeledField
          label="Password"
          required
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          error={show(errors.password)}
        >
          {p => (
            <PasswordInput
              {...p}
              autoComplete="new-password"
              value={values.password}
              onChange={set("password")}
              disabled={loading}
              className={authInput}
            />
          )}
        </LabeledField>
        <LabeledField label="Password again" required error={show(errors.confirm_password)}>
          {p => (
            <PasswordInput
              {...p}
              autoComplete="new-password"
              value={values.confirm_password}
              onChange={set("confirm_password")}
              disabled={loading}
              className={authInput}
            />
          )}
        </LabeledField>

        <Button type="submit" className={authButton} loading={loading}>
          {loading ? "Setting up..." : "Create account and sign in"}
        </Button>
      </form>
    </div>
  );
}
