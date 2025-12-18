"use client";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { Session } from "next-auth";
import Link from "next/link";
import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import DataFetchError from "@/components/common/DataFetchError";
import { useGyms } from "@/hooks/use-gyms";
import { columns } from "./columns";

const Gyms = ({ session }: { session: Session }) => {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedFilter = useDebounce(globalFilter, 1000);

  const { data, isLoading, error, refetch } = useGyms({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    search: debouncedFilter,
    enabled: true,
  });

  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-6">
        <h1 className="h1">Gyms</h1>
        <Link href={`/gyms/manage?action=create`}>
          <Button>Create Gym</Button>
        </Link>
      </div>

      {isLoading && !data && (
        <div className="flex justify-center items-center h-64">
          <FullScreenLoader label="Loading Gyms..." />
        </div>
      )}

      {error && (
        <DataFetchError error={error} onRetry={() => refetch()} message="Error loading gyms" />
      )}

      {data && (
        <DataTable
          columns={columns}
          data={data.data}
          searchableColumns={["name", "owner.first_name", "owner.last_name", "owner.email", "city"]}
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

export default Gyms;


