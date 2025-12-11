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
import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";

const Subscription = ({ session }: { session: Session }) => {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedFilter = useDebounce(globalFilter, 1000);

  const { data, isLoading, error } = useQuery({
    queryKey: ["subscriptions", pagination.pageIndex, pagination.pageSize, debouncedFilter],
    queryFn: async () => {
      const response = await axios.post("/api/subscription/getsubscriptions", {
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: debouncedFilter,
      });
      return response.data as { data: SubscriptionType[]; totalCount: number; pageCount: number };
    },
    placeholderData: (previousData) => previousData, // Keep previous data while fetching new data
  });

  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-6">
        <h1 className="h1">Subscriptions</h1>
        <Link href={`/subscriptions/manage?action=create`}>
          <Button>Create Subscription</Button>
        </Link>
      </div>

      {isLoading && !data && (
        <div className="flex justify-center items-center h-64">
          <p>Loading subscriptions...</p>
        </div>
      )}

      {error && (
        <div className="flex justify-center items-center h-64 text-red-500">
          <p>Error loading subscriptions: {error instanceof Error ? error.message : "Unknown error"}</p>
        </div>
      )}

      {data && (
        <DataTable
          columns={columns}
          data={data.data}
          searchableColumns={["name", "monthly_price", "yearly_price"]}
          pageCount={data.pageCount}
          rowCount={data.totalCount}
          onPaginationChange={setPagination}
          onSearchChange={setGlobalFilter}
          pagination={pagination}
          searchValue={globalFilter}
        />
      )}
    </PageContainer>
  );
};

export default Subscription;
