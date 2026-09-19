import { LoginBrandPanel } from "@/components/auth/login-brand-panel";
import { LoginForm } from "@/components/forms/login-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to manage your gym's members, subscriptions, and equipment.",
};

const SignInPage = () => {
  return (
    <div className="login-theme flex min-h-svh flex-col lg:flex-row">
      <LoginBrandPanel />
      <main className="flex flex-1 items-center justify-center bg-background px-5 py-10 sm:px-8 lg:w-[56%] lg:px-12">
        <LoginForm />
      </main>
    </div>
  );
};

export default SignInPage;
