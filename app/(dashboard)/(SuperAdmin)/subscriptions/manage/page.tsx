"use client";
import { PageContainer } from "@/components/layout/page-container";
import { useSearchParams } from "next/navigation";

const ManageSubscriptions = () => {
  const searchParams = useSearchParams();
  const action = searchParams?.get("action") as string;

  return (
    <PageContainer>
      <h1 className="h1">
        {action === "create"
          ? "Create Subscription"
          : action === "edit"
          ? "Edit Subscription"
          : "View Subscription"}
      </h1>
    </PageContainer>
  );
};

export default ManageSubscriptions;
