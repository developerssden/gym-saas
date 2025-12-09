"use client";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Session } from "next-auth";
import Link from "next/link";
import { columns } from "./columns";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Subscription as SubscriptionType } from "@/types";

const Subscription = ({ session }: { session: Session }) => {
  const { data: subscriptions, isLoading, error } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const response = await axios.get<SubscriptionType[]>("/api/subscription/getsubscriptions");
      return response.data;
    },
  });

  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-6">
        <h1 className="h1">Subscriptions</h1>
        <Link href={`/subscriptions/manage?action=create`}>
          <Button>Create Subscription</Button>
        </Link>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center h-64">
          <p>Loading subscriptions...</p>
        </div>
      )}

      {error && (
        <div className="flex justify-center items-center h-64 text-red-500">
          <p>Error loading subscriptions: {error instanceof Error ? error.message : "Unknown error"}</p>
        </div>
      )}

      {subscriptions && !isLoading && !error && (
        <DataTable
          columns={columns}
          data={subscriptions}
          searchableColumns={["name", "monthly_price", "yearly_price"]}
        />
      )}
    </PageContainer>
  );
};

export default Subscription;
