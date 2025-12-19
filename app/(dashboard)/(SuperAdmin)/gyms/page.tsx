 "use client";

import FullScreenLoader from "@/components/common/FullScreenLoader";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import Gyms from "@/components/SuperAdmin/gym/Gym";

const GymsPage = () => {
  const { data: session, status } = useSession({ required: true });
  if (status === "loading") {
    return <FullScreenLoader />;
  }
  if (session?.user?.role !== "SUPER_ADMIN" && session?.user?.role !== "GYM_OWNER") {
    return redirect("/unauthorized");
  }
  return <Gyms session={session} />;
};

export default GymsPage;


