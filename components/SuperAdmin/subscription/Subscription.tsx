"use client";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Session } from "next-auth";
import Link from "next/link";
import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import DataFetchError from "@/components/common/DataFetchError";
import { useOwnerSubscriptions } from "@/hooks/use-owner-subscriptions";
import { columns } from "./columns";

const Subscriptions = ({ session }: { session: Session }) => {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedFilter = useDebounce(globalFilter, 1000);

  // Use the hook
  const { data, isLoading, error, refetch } = useOwnerSubscriptions({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    search: debouncedFilter,
    enabled: true,
  });

  return (
    <PageContainer>
      <PageHeader
        title="Owner subscriptions"
        description="Which plan each gym owner is on and when it ends."
        actions={
          <Button asChild>
            <Link href={`/subscriptions/manage?action=create`}>
              <Plus aria-hidden /> Add subscription
            </Link>
          </Button>
        }
      />

      {isLoading && !data && (
        <div className="flex justify-center items-center h-64">
          <FullScreenLoader label="Loading Subscriptions..." />
        </div>
      )}

      {error && (
        <DataFetchError
          error={error}
          onRetry={() => refetch()}
          message="Error loading subscriptions"
        />
      )}

      {data && (
        <DataTable
          columns={columns}
          data={data.data}
          searchableColumns={["owner.first_name", "owner.last_name", "plan.name"]}
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

export default Subscriptions;
