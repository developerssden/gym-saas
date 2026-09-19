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
import { gymOwnerColumns, superAdminColumns } from "./columns";
import { useSubscriptionValidation } from "@/hooks/useSubscriptionValidation";
import { Progress } from "@/components/ui/progress";
import { Plus } from "lucide-react";

const Gyms = ({ session }: { session: Session }) => {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedFilter = useDebounce(globalFilter, 1000);
  const isGymOwner = session.user.role === "GYM_OWNER";

  const { data, isLoading, error, refetch } = useGyms({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    search: debouncedFilter,
    enabled: true,
  });

  const {
    currentGyms,
    gymLimit,
    isAtGymLimit,
    isNearGymLimit,
    isGymUsageLoading,
  } = useSubscriptionValidation({
    gymCount: !debouncedFilter ? data?.totalCount : undefined,
  });

  const handleSearchChange = (value: string) => {
    setGlobalFilter(value);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  };

  const usagePercent =
    gymLimit > 0 ? Math.min(100, Math.round((currentGyms / gymLimit) * 100)) : 0;
  const columns = isGymOwner ? gymOwnerColumns : superAdminColumns;

  return (
    <PageContainer>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            {isGymOwner ? "Your gyms" : "Gyms"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isGymOwner
              ? "Manage the gyms and locations under your account."
              : "Every gym on the platform, across all owners."}
          </p>
        </div>
        <Link href="/gyms/manage?action=create">
          <Button className="w-full sm:w-auto">
            <Plus className="size-4" />
            Create gym
          </Button>
        </Link>
      </div>

      {isGymOwner && (
        <section
          className="mb-6 rounded-lg border border-border bg-card p-4 text-card-foreground"
          aria-labelledby="gym-plan-usage"
        >
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <p id="gym-plan-usage" className="text-sm font-semibold text-foreground">
                {isGymUsageLoading
                  ? "Loading plan usage…"
                  : `${currentGyms} of ${gymLimit} gyms used on your plan`}
              </p>
              {(isAtGymLimit || isNearGymLimit) && !isGymUsageLoading && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {isAtGymLimit
                    ? "You have reached your current plan limit."
                    : "You are approaching your current plan limit."}
                </p>
              )}
            </div>
            {!isGymUsageLoading && (
              <span className="text-xs font-medium text-muted-foreground">
                {usagePercent}%
              </span>
            )}
          </div>
          <Progress
            value={usagePercent}
            aria-label={`${currentGyms} of ${gymLimit} gyms used`}
            className="h-1.5 bg-border [&_[data-slot=progress-indicator]]:bg-primary-dim"
          />
        </section>
      )}

      {isLoading && !data && (
        <div className="flex justify-center items-center h-64">
          <FullScreenLoader label="Loading gyms..." />
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
          onSearchChange={handleSearchChange}
          pagination={pagination}
          searchValue={globalFilter}
          isSearching={Boolean(debouncedFilter.trim())}
          searchLabel="Search gyms"
          searchPlaceholder="Search gyms"
          emptyMessage="No gyms yet — create your first one."
          emptyDescription="Add a gym to start managing its locations and members."
          searchEmptyMessage="No gyms match your search."
          searchEmptyDescription="Try another name, city, or owner."
          emptyAction={
            <Button asChild size="sm">
              <Link href="/gyms/manage?action=create">
                <Plus className="size-4" />
                Create gym
              </Link>
            </Button>
          }
        />
      )}
    </PageContainer>
  );
};

export default Gyms;


