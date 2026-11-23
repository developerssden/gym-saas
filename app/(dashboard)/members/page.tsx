"use client";

import { useState } from "react";
import Link from "next/link";
import axios from "axios";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Plus } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import DataFetchError from "@/components/common/DataFetchError";
import { useDebounce } from "@/hooks/use-debounce";
import { useSubscriptionValidation } from "@/hooks/useSubscriptionValidation";
import { usePermissions } from "@/hooks/usePermissions";
import { MemberCard, columns, memberHref, type MemberRow } from "@/components/members/columns";
import { SubscriptionExpiredModal } from "@/components/subscription/SubscriptionExpiredModal";
import type { MemberStatusFilter } from "@/lib/members/member-status";
import { cn } from "@/lib/utils";

type Filter = "all" | MemberStatusFilter;

type MembersResponse = {
  data: MemberRow[];
  totalCount: number;
  pageCount: number;
  counts: Record<Filter, number>;
};

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "expiring", label: "Expiring" },
  { id: "expired", label: "Expired" },
  { id: "owing", label: "Owing" },
];

const EMPTY: Record<Exclude<Filter, "all">, string> = {
  active: "No members with an active membership.",
  expiring: "No memberships end in the next 7 days.",
  expired: "No expired members. Everyone has renewed.",
  frozen: "No frozen memberships.",
  owing: "No one owes you money.",
};

const MembersPage = () => {
  const { data: session, status } = useSession({ required: true });
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const debouncedFilter = useDebounce(globalFilter, 400);
  const { isSubscriptionActive, subscriptionExpired } = useSubscriptionValidation();
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const { can } = usePermissions();

  const selectedGymId = session?.user?.selected_gym_id;
  const selectedLocationId = session?.user?.selected_location_id;

  const { data, isLoading, error, refetch } = useQuery<MembersResponse>({
    queryKey: [
      "members",
      "with-status",
      pagination.pageIndex + 1,
      pagination.pageSize,
      debouncedFilter,
      filter,
      selectedGymId,
      selectedLocationId,
    ],
    queryFn: async () => {
      const res = await axios.post("/api/members/getmembers", {
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: debouncedFilter,
        gym_id: selectedGymId || undefined,
        location_id: selectedLocationId || undefined,
        with_status: true,
        status: filter === "all" ? undefined : filter,
      });
      return res.data;
    },
    // Keep the list, chips and search box on screen while the next page loads.
    placeholderData: keepPreviousData,
    enabled: status === "authenticated" && (session?.user?.role === "GYM_OWNER" || session?.user?.role === "STAFF") && !!selectedGymId,
  });

  if (status === "loading") {
    return (
      <PageContainer>
        <Skeleton className="mb-6 h-9 w-48" />
        <Skeleton className="h-64 w-full" />
      </PageContainer>
    );
  }
  if (session?.user?.role !== "GYM_OWNER" && session?.user?.role !== "STAFF") {
    return redirect("/unauthorized");
  }

  const chooseFilter = (next: Filter) => {
    setFilter(next);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const memberActions = !can("members.create") && !can("members.import") ? null : !isSubscriptionActive || subscriptionExpired ? (
    <Button onClick={() => setShowExpiredModal(true)}>
      <Plus aria-hidden /> Add member
    </Button>
  ) : (
    <>
      {can("members.import") && (
        <Button variant="outline" asChild>
          <Link href="/members/import">
            <FileSpreadsheet aria-hidden /> Import from Excel
          </Link>
        </Button>
      )}
      {can("members.create") && (
        <Button asChild>
          <Link href={`/members/manage?action=create`}>
            <Plus aria-hidden /> Add member
          </Link>
        </Button>
      )}
    </>
  );

  return (
    <PageContainer>
      <PageHeader title="Members" description="Everyone who trains at this branch." actions={memberActions} />

      {!selectedGymId ? (
        <div className="mb-4 rounded-md bg-muted p-4">
          <p className="text-sm text-muted-foreground">Choose a gym and branch at the top of the page to see members.</p>
        </div>
      ) : (
        <>
          {/* Status filters, with how many members are in each. */}
          <div
            role="group"
            aria-label="Show members"
            className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
          >
            {FILTERS.map((f) => {
              const count = data?.counts?.[f.id];
              const selected = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => chooseFilter(f.id)}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors md:min-h-9",
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"
                  )}
                >
                  {f.label}
                  {count !== undefined && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-xs tabular-nums",
                        selected
                          ? "bg-primary-foreground/15"
                          : f.id === "expired" || f.id === "owing"
                            ? count > 0
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                            : f.id === "expiring" && count > 0
                              ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                              : "bg-muted text-muted-foreground"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {error ? (
            <DataFetchError error={error} onRetry={() => refetch()} message="Couldn't load members" />
          ) : (
            <DataTable
              columns={columns}
              data={data?.data ?? []}
              isLoading={isLoading && !data}
              mobileCard={(member) => <MemberCard key={member.id} member={member} />}
              getRowHref={memberHref}
              searchPlaceholder="Search by name or phone"
              searchableColumns={["name"]}
              isSearching={!!debouncedFilter.trim()}
              emptyMessage={filter === "all" ? "No members yet" : EMPTY[filter]}
              emptyDescription={
                filter === "all" ? "Import your member list from Excel in one go, or add members one by one." : undefined
              }
              emptyAction={filter === "all" ? memberActions : undefined}
              searchEmptyDescription="Try part of their name or phone number, e.g. 0301 234."
              pageCount={data?.pageCount ?? 1}
              rowCount={data?.totalCount}
              onPaginationChange={setPagination}
              onSearchChange={(value) => {
                setGlobalFilter(value);
                setPagination((p) => ({ ...p, pageIndex: 0 }));
              }}
              pagination={pagination}
              searchValue={globalFilter}
            />
          )}
        </>
      )}

      <SubscriptionExpiredModal open={showExpiredModal} onClose={() => setShowExpiredModal(false)} />
    </PageContainer>
  );
};

export default MembersPage;
