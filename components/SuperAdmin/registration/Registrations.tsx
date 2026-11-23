"use client";

import { useState } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import DataFetchError from "@/components/common/DataFetchError";
import { useDebounce } from "@/hooks/use-debounce";
import { useRegistrations } from "@/hooks/use-registrations";
import { columns } from "./columns";

const Registrations = () => {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedFilter = useDebounce(globalFilter, 1000);

  const { data, isLoading, error, refetch } = useRegistrations({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    search: debouncedFilter,
  });

  return (
    <PageContainer>
      <PageHeader
        title="Registrations"
        description={<>Gym owners who filled in the &quot;Register your gym&quot; form on the landing page.</>}
      />

      {isLoading && !data && (
        <div className="flex h-64 items-center justify-center">
          <FullScreenLoader label="Loading Registrations..." />
        </div>
      )}

      {error && (
        <DataFetchError error={error} onRetry={() => refetch()} message="Error loading registrations" />
      )}

      {data && (
        <DataTable
          columns={columns}
          data={data.data}
          searchableColumns={["owner_name", "gym_name", "city", "phone", "status"]}
          searchPlaceholder="Search by owner, gym, city or phone"
          emptyMessage="No registrations yet"
          emptyDescription="New sign-ups from the landing page will show up here."
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

export default Registrations;
