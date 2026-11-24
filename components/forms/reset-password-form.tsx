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
import { PasswordInput } from "@/components/ui/password-input";
import { PASSWORD_MIN_LENGTH } from "@/lib/profile";
import { newPasswordErrors } from "@/lib/onboarding";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // The link itself is bad (used, expired, unknown): offer a new one instead of the form.
  const [linkProblem, setLinkProblem] = useState(token ? "" : "This reset link isn't complete. Ask for a new one.");

  const errors = newPasswordErrors(password, confirm);
  const show = (e?: string) => (submitted ? e : undefined);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setError("");
    if (Object.keys(errors).length > 0) return;
    setLoading(true);
    try {
      const res = await axios.post<{ email: string | null }>("/api/password/reset", { token, password });
      const email = res.data.email;
      // Sign straight in with the new password.
      const result = email ? await signIn("credentials", { email, password, remember: "false", redirect: false }) : null;
      if (result && !result.error) {
        router.push("/dashboard");
        router.refresh();
      } else {
        router.push("/sign-in");
      }
    } catch (err) {
      const data = axios.isAxiosError(err) ? err.response?.data : undefined;
      if (data?.reason) setLinkProblem(data.message);
      else setError(data?.message ?? "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  if (linkProblem) {
    return (
      <div className="w-full max-w-[380px]">
        <AuthHeading title="This link doesn't work">{linkProblem}</AuthHeading>
        <Button asChild className={authButton}>
          <Link href="/forgot-password">Send me a new link</Link>
        </Button>
        <p className="mt-8 border-t border-border-soft pt-5 text-sm">
          <Link href="/sign-in" className={authLink}>
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[380px]">
      <AuthHeading title="Choose a new password">You&apos;ll be signed in straight after.</AuthHeading>

      <form onSubmit={submit} noValidate className="space-y-5">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <LabeledField label="New password" hint={`At least ${PASSWORD_MIN_LENGTH} characters.`} error={show(errors.password)}>
          {p => (
            <PasswordInput
              {...p}
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              className={authInput}
            />
          )}
        </LabeledField>
        <LabeledField label="New password again" error={show(errors.confirm_password)}>
          {p => (
            <PasswordInput
              {...p}
              autoComplete="new-password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              disabled={loading}
              className={authInput}
            />
          )}
        </LabeledField>
        <Button type="submit" className={authButton} loading={loading}>
          {loading ? "Saving..." : "Save and sign in"}
        </Button>
      </form>
    </div>
  );
}
