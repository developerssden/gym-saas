"use client";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Session } from "next-auth";
import Link from "next/link";
import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import DataFetchError from "@/components/common/DataFetchError";
import { usePayments } from "@/hooks/use-payments";
import { columns } from "./columns";

const Payments = ({ session }: { session: Session }) => {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedFilter = useDebounce(globalFilter, 1000);

  // Use the hook
  const { data, isLoading, error, refetch } = usePayments({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    enabled: true,
  });

  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-6">
        <h1 className="h1">Payments</h1>
        <Link href={`/payments/manage?action=create`}>
          <Button>Create Payment</Button>
        </Link>
      </div>

      {isLoading && !data && (
        <div className="flex justify-center items-center h-64">
          <FullScreenLoader label="Loading Payments..." />
        </div>
      )}

      {error && (
        <DataFetchError
          error={error}
          onRetry={() => refetch()}
          message="Error loading payments"
        />
      )}

      {data && (
        <DataTable
          columns={columns}
          data={data.data}
          searchableColumns={["transaction_id"]}
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

export default Payments;

