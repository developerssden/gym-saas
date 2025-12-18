"use client";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import Plans from "@/components/SuperAdmin/plan/Plan";

const ClientsPage = () => {
  const { data: session, status } = useSession({ required: true });
  if (status === "loading") {
    return <FullScreenLoader />;
  }
  if (session?.user?.role !== "SUPER_ADMIN") {
    return redirect("/unauthorized");
  }
  return <Plans session={session} />;
};

export default ClientsPage;
