"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function CheckoutSuccessClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status } = useSession();
  const checkoutId = searchParams?.get("checkout_id");
  const [countdown, setCountdown] = useState(5);

  const isSignedIn = status === "authenticated";
  const redirectTo = isSignedIn ? "/dashboard" : "/sign-in";

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push(redirectTo);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [router, redirectTo]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg
          className="h-8 w-8 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Payment successful
        </h1>
        <p className="text-muted-foreground max-w-sm">
          Your Gym SaaS subscription is now active. You can start setting up
          your gym right away.
        </p>
        {checkoutId && (
          <p className="text-xs text-muted-foreground">
            Reference: {checkoutId}
          </p>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Redirecting to {isSignedIn ? "your dashboard" : "sign in"} in{" "}
        {countdown}s…
      </p>

      <Link
        href={redirectTo}
        className="text-sm font-medium underline underline-offset-4"
      >
        {isSignedIn ? "Go to dashboard now" : "Sign in now"}
      </Link>
    </div>
  );
}
