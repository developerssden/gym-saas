"use client";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import Payments from "@/components/SuperAdmin/payment/Payment";

const PaymentsPage = () => {
  const { data: session, status } = useSession({ required: true });
  if (status === "loading") {
    return <FullScreenLoader />;
  }
  if (session?.user?.role !== "SUPER_ADMIN") {
    return redirect("/unauthorized");
  }
  return <Payments session={session} />;
};

export default PaymentsPage;

