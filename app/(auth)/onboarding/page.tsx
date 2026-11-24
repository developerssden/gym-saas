import { AuthShell } from "@/components/auth/auth-shell";
import { OnboardingForm } from "@/components/forms/onboarding-form";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Set up your account",
  description: "Choose your password and start using your gym account.",
};

const OnboardingPage = () => {
  return (
    <AuthShell compact>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
        <OnboardingForm />
      </Suspense>
    </AuthShell>
  );
};

export default OnboardingPage;
