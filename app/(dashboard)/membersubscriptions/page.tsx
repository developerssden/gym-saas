"use client";

import { useState } from "react";
import Link from "next/link";
import axios from "axios";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import DataFetchError from "@/components/common/DataFetchError";
import { useDebounce } from "@/hooks/use-debounce";
import { usePermissions } from "@/hooks/usePermissions";
import { useSubscriptionValidation } from "@/hooks/useSubscriptionValidation";
import { MembershipCard, columns, type MembershipRow } from "@/components/membersubscriptions/columns";
import { SubscriptionExpiredModal } from "@/components/subscription/SubscriptionExpiredModal";
import type { MemberStatusFilter } from "@/lib/members/member-status";
import { cn } from "@/lib/utils";

type Tab = Exclude<MemberStatusFilter, "active"> | "all";

type Response = {
  data: MembershipRow[];
  totalCount: number;
  pageCount: number;
  counts: Record<"all" | MemberStatusFilter, number>;
};

const TABS: Array<{ id: Tab; label: string; tone: "due" | "bad" | "neutral" }> = [
  { id: "expiring", label: "Expiring soon", tone: "due" },
  { id: "expired", label: "Expired", tone: "bad" },
  { id: "owing", label: "Owing", tone: "bad" },
  { id: "frozen", label: "Frozen", tone: "neutral" },
  { id: "all", label: "All", tone: "neutral" },
];

const EMPTY: Record<Tab, string> = {
  expiring: "No memberships end in the next 7 days.",
  expired: "No expired memberships. Everyone has renewed.",
  owing: "No one owes you money.",
  frozen: "No frozen memberships.",
  all: "No memberships yet",
};

/** One row per member: their current membership, or the last one once it has ended. */
const MembershipsPage = () => {
  const { data: session, status } = useSession({ required: true });
  const { can } = usePermissions();
  const { isSubscriptionActive, subscriptionExpired } = useSubscriptionValidation();
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedFilter = useDebounce(globalFilter, 400);
  const [tab, setTab] = useState<Tab>("expiring");
  const [tabChosen, setTabChosen] = useState(false);

  const selectedGymId = session?.user?.selected_gym_id;
  const selectedLocationId = session?.user?.selected_location_id;

  const { data, isLoading, error, refetch } = useQuery<Response>({
    queryKey: [
      "membersubscriptions",
      "by-member",
      tab,
      pagination.pageIndex + 1,
      pagination.pageSize,
      debouncedFilter,
      selectedGymId,
      selectedLocationId,
    ],
    queryFn: async () =>
      (
        await axios.post("/api/members/getmembers", {
          page: pagination.pageIndex + 1,
          limit: pagination.pageSize,
          search: debouncedFilter,
          gym_id: selectedGymId || undefined,
          location_id: selectedLocationId || undefined,
          with_status: true,
          has_membership: true,
          status: tab === "all" ? undefined : tab,
        })
      ).data,
    placeholderData: keepPreviousData,
    enabled: status === "authenticated" && (session?.user?.role === "GYM_OWNER" || session?.user?.role === "STAFF") && !!selectedGymId,
  });

  // Once the first counts arrive, open the first tab with someone to chase.
  if (data && !tabChosen) {
    const c = data.counts;
    const first: Tab = c.expiring > 0 ? "expiring" : c.expired > 0 ? "expired" : c.owing > 0 ? "owing" : "all";
    setTabChosen(true);
    if (first !== tab) setTab(first);
  }

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

  const chooseTab = (next: Tab) => {
    setTabChosen(true);
    setTab(next);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const createAction = !can("membersubscriptions.create") ? null : !isSubscriptionActive || subscriptionExpired ? (
    <Button onClick={() => setShowExpiredModal(true)}>
      <Plus aria-hidden /> Add membership
    </Button>
  ) : (
    <Button asChild>
      <Link href="/membersubscriptions/manage?action=create">
        <Plus aria-hidden /> Add membership
      </Link>
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader title="Memberships" description="Who is due soon, who has expired and who owes you." actions={createAction} />

      {!selectedGymId ? (
        <div className="mb-4 rounded-md bg-muted p-4">
          <p className="text-sm text-muted-foreground">Choose a gym and branch at the top of the page to see memberships.</p>
        </div>
      ) : (
        <>
          <div role="group" aria-label="Show memberships" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {TABS.map((t) => {
              const count = data?.counts?.[t.id];
              const selected = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => chooseTab(t.id)}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors md:min-h-9",
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"
                  )}
                >
                  {t.label}
                  {count !== undefined && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-xs tabular-nums",
                        selected
                          ? "bg-primary-foreground/15"
                          : count === 0 || t.tone === "neutral"
                            ? "bg-muted text-muted-foreground"
                            : t.tone === "due"
                              ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                              : "bg-destructive/10 text-destructive"
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
            <DataFetchError error={error} onRetry={() => refetch()} message="Couldn't load memberships" />
          ) : (
            <DataTable
              columns={columns}
              data={data?.data ?? []}
              isLoading={isLoading && !data}
              mobileCard={(row) => <MembershipCard key={row.id} row={row} />}
              getRowHref={(row) => `/members/${row.id}`}
              searchPlaceholder="Search by name or phone"
              searchableColumns={["member"]}
              isSearching={!!debouncedFilter.trim()}
              emptyMessage={EMPTY[tab]}
              emptyDescription={
                tab === "all" ? "Give a member a monthly or yearly membership to track their fees and due dates." : undefined
              }
              emptyAction={tab === "all" ? createAction : undefined}
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

export default MembershipsPage;
