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
import { gymOwnerColumns, superAdminColumns } from "./columns";
import { useSubscriptionValidation } from "@/hooks/useSubscriptionValidation";
import { Progress } from "@/components/ui/progress";
import { Plus } from "lucide-react";

const Locations = ({ session }: { session: Session }) => {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedFilter = useDebounce(globalFilter, 1000);
  const isGymOwner = session.user.role === "GYM_OWNER";

  const { data, isLoading, error, refetch } = useLocations({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    search: debouncedFilter,
    enabled: true,
  });

  const {
    currentLocations,
    locationLimit,
    isAtLocationLimit,
    isNearLocationLimit,
    isLocationUsageLoading,
  } = useSubscriptionValidation({
    locationCount: !debouncedFilter ? data?.totalCount : undefined,
    includeLocationUsage: true,
  });

  const handleSearchChange = (value: string) => {
    setGlobalFilter(value);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  };

  const usagePercent =
    locationLimit > 0
      ? Math.min(100, Math.round((currentLocations / locationLimit) * 100))
      : 0;
  const columns = isGymOwner ? gymOwnerColumns : superAdminColumns;

  return (
    <PageContainer>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            {isGymOwner ? "Your locations" : "Locations"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isGymOwner
              ? "Manage the locations across your gyms."
              : "Every location on the platform, across all gyms and owners."}
          </p>
        </div>
        <Link href="/locations/manage?action=create">
          <Button className="w-full sm:w-auto">
            <Plus className="size-4" />
            Create location
          </Button>
        </Link>
      </div>

      {isGymOwner && (
        <section
          className="mb-6 rounded-lg border border-border bg-card p-4 text-card-foreground"
          aria-labelledby="location-plan-usage"
        >
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <p
                id="location-plan-usage"
                className="text-sm font-semibold text-foreground"
              >
                {isLocationUsageLoading
                  ? "Loading plan usage…"
                  : `${currentLocations} of ${locationLimit} locations used on your plan`}
              </p>
              {(isAtLocationLimit || isNearLocationLimit) &&
                !isLocationUsageLoading && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isAtLocationLimit
                      ? "You have reached your current plan limit."
                      : "You are approaching your current plan limit."}
                  </p>
                )}
            </div>
            {!isLocationUsageLoading && (
              <span className="text-xs font-medium text-muted-foreground">
                {usagePercent}%
              </span>
            )}
          </div>
          <Progress
            value={usagePercent}
            aria-label={`${currentLocations} of ${locationLimit} locations used`}
            className="h-1.5 bg-border [&_[data-slot=progress-indicator]]:bg-primary-dim"
          />
        </section>
      )}

      {isLoading && !data && (
        <div className="flex justify-center items-center h-64">
          <FullScreenLoader label="Loading Locations..." />
        </div>
      )}

      {error && (
        <DataFetchError
          error={error}
          onRetry={() => refetch()}
          message="Error loading locations"
        />
      )}

      {data && (
        <DataTable
          columns={columns}
          data={data.data}
          searchableColumns={[
            "name",
            "gym.name",
            "gym.owner.first_name",
            "gym.owner.last_name",
            "city",
          ]}
          pageCount={data.pageCount}
          rowCount={data.totalCount}
          onPaginationChange={setPagination}
          onSearchChange={handleSearchChange}
          pagination={pagination}
          searchValue={globalFilter}
          isSearching={Boolean(debouncedFilter.trim())}
          searchLabel="Search locations"
          searchPlaceholder="Search locations"
          emptyMessage="No locations yet — create your first one."
          emptyDescription="Add a location to start managing its members and equipment."
          searchEmptyMessage="No locations match your search."
          searchEmptyDescription="Try another location, gym, city, or owner."
          emptyAction={
            <Button asChild size="sm">
              <Link href="/locations/manage?action=create">
                <Plus className="size-4" />
                Create location
              </Link>
            </Button>
          }
        />
      )}
    </PageContainer>
  );
};

export default Locations;
