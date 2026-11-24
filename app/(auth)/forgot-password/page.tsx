import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Get a link to choose a new password.",
};

const ForgotPasswordPage = () => (
  <AuthShell compact>
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
      <ForgotPasswordForm />
    </Suspense>
  </AuthShell>
);

export default ForgotPasswordPage;
