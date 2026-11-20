"use client";

import FullScreenLoader from "@/components/common/FullScreenLoader";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import Registrations from "@/components/SuperAdmin/registration/Registrations";

const RegistrationsPage = () => {
  const { data: session, status } = useSession({ required: true });
  if (status === "loading") {
    return <FullScreenLoader />;
  }
  if (session?.user?.role !== "SUPER_ADMIN") {
    return redirect("/unauthorized");
  }
  return <Registrations />;
};

export default RegistrationsPage;
