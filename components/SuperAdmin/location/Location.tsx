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
import { useLocations } from "@/hooks/use-locations";
import { columns } from "./columns";

const Locations = ({ session }: { session: Session }) => {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedFilter = useDebounce(globalFilter, 1000);

  const { data, isLoading, error, refetch } = useLocations({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    search: debouncedFilter,
    enabled: true,
  });

  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-6">
        <h1 className="h1">Locations</h1>
        <Link href={`/locations/manage?action=create`}>
          <Button>Create Location</Button>
        </Link>
      </div>

      {isLoading && !data && (
        <div className="flex justify-center items-center h-64">
          <FullScreenLoader label="Loading Locations..." />
        </div>
      )}

      {error && (
        <DataFetchError error={error} onRetry={() => refetch()} message="Error loading locations" />
      )}

      {data && (
        <DataTable
          columns={columns}
          data={data.data}
          searchableColumns={["name", "gym.name", "gym.owner.first_name", "gym.owner.last_name", "city"]}
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

export default Locations;


