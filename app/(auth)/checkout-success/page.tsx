import { Suspense } from "react";
import CheckoutSuccessClient from "@/components/checkout-success-client";

export const metadata = {
  title: "Payment Successful | Gym SaaS",
};

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          Loading...
        </div>
      }
    >
      <CheckoutSuccessClient />
    </Suspense>
  );
}
