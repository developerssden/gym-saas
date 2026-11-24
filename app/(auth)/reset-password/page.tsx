import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Set a new password for your account.",
};

const ResetPasswordPage = () => (
  <AuthShell compact>
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
      <ResetPasswordForm />
    </Suspense>
  </AuthShell>
);

export default ResetPasswordPage;
