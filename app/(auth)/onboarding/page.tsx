import { OnboardingForm } from "@/components/forms/onboarding-form";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Complete Your Profile",
  description: "Complete your gym owner account setup",
};

const OnboardingPage = () => {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-2xl">
        <Suspense fallback={<div className="text-center text-sm">Loading...</div>}>
          <OnboardingForm />
        </Suspense>
      </div>
    </div>
  );
};

export default OnboardingPage;
