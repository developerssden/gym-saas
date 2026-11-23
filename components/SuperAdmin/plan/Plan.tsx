"use client";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Session } from "next-auth";
import Link from "next/link";
import { columns } from "./columns";
import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import DataFetchError from "@/components/common/DataFetchError";
import { usePlans } from "@/hooks/use-plans";

const Plans = ({ session }: { session: Session }) => {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedFilter = useDebounce(globalFilter, 1000);

  // Use the hook
  const { data, isLoading, error, refetch } = usePlans({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    search: debouncedFilter,
    enabled: true,
  });

  return (
    <PageContainer>
      <PageHeader
        title="Plans"
        description="What gym owners can subscribe to."
        actions={
          <Button asChild>
            <Link href={`/plans/manage?action=create`}>
              <Plus aria-hidden /> Add plan
            </Link>
          </Button>
        }
      />

      {isLoading && !data && (
        <div className="flex justify-center items-center h-64">
          <FullScreenLoader label="Loading Plans..." />
        </div>
      )}

      {error && (
        <DataFetchError
          error={error}
          onRetry={() => refetch()}
          message="Error loading plans"
        />
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

export default Plans;
