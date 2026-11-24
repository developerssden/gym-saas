"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import { MailCheck } from "lucide-react";

import { AuthHeading, authButton, authInput, authLink } from "@/components/auth/auth-shell";
import { LabeledField } from "@/components/forms/labeled-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EMAIL_PATTERN } from "@/lib/password-reset";

export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams?.get("email") ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState("");

  const emailError = !email.trim()
    ? "Enter the email you sign in with"
    : !EMAIL_PATTERN.test(email.trim())
      ? "That email doesn't look right"
      : undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setError("");
    if (emailError) return;
    setLoading(true);
    try {
      await axios.post("/api/password/forgot", { email: email.trim() });
      setSentTo(email.trim());
    } catch (err) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <div className="w-full max-w-[380px]">
        <MailCheck aria-hidden className="mb-4 size-10 text-primary" />
        <AuthHeading title="Check your email">
          If <strong className="text-foreground">{sentTo}</strong> has an account, we&apos;ve sent it a link to choose a new
          password. The link works for 1 hour.
        </AuthHeading>
        <p className="text-sm text-muted-foreground">
          Nothing after a few minutes? Check your spam folder, or{" "}
          <button type="button" className={authLink} onClick={() => setSentTo(null)}>
            try again
          </button>
          .
        </p>
        <Button asChild className={`${authButton} mt-8`}>
          <Link href="/sign-in">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[380px]">
      <AuthHeading title="Forgot your password?">
        Enter the email you sign in with and we&apos;ll send you a link to choose a new one.
      </AuthHeading>

      <form onSubmit={submit} noValidate className="space-y-5">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <LabeledField label="Email" error={submitted ? emailError : undefined}>
          {p => (
            <Input
              {...p}
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@yourgym.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              className={authInput}
            />
          )}
        </LabeledField>
        <Button type="submit" className={authButton} loading={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </Button>
      </form>

      <p className="mt-8 border-t border-border-soft pt-5 text-sm">
        <Link href="/sign-in" className={authLink}>
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
