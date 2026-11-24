import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/forms/login-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to manage your gym's members, subscriptions, and equipment.",
};

const SignInPage = () => {
  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
};

export default SignInPage;
