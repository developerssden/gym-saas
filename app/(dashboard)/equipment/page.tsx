"use client";

import { useState } from "react";
import axios from "axios";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { startOfDay } from "date-fns";
import { AlertTriangle, Plus } from "lucide-react";
import DataFetchError from "@/components/common/DataFetchError";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { EquipmentCard, columns, type EquipmentRow } from "@/components/equipment/columns";
import EquipmentDialog from "@/components/equipment/EquipmentDialog";
import { SubscriptionLimitModal } from "@/components/subscription/SubscriptionLimitModal";
import { SubscriptionExpiredModal } from "@/components/subscription/SubscriptionExpiredModal";
import { useDebounce } from "@/hooks/use-debounce";
import { usePermissions } from "@/hooks/usePermissions";
import { useSubscriptionValidation } from "@/hooks/useSubscriptionValidation";
import { MAINTENANCE_SOON_DAYS } from "@/lib/equipment";

type EquipmentResponse = {
  data: EquipmentRow[];
  totalCount: number;
  pageCount: number;
  overdueCount: number;
  dueSoonCount: number;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const EquipmentPage = () => {
  const { data: session, status } = useSession({ required: true });
  const { can } = usePermissions();
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedFilter = useDebounce(globalFilter, 400);
  const { isSubscriptionActive, subscriptionExpired } = useSubscriptionValidation();
  const [adding, setAdding] = useState(false);
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const [limit, setLimit] = useState<{ current?: number; max?: number } | null>(null);

  const selectedGymId = session?.user?.selected_gym_id;
  const selectedLocationId = session?.user?.selected_location_id;

  const { data, isLoading, error, refetch } = useQuery<EquipmentResponse>({
    queryKey: ["equipment", pagination.pageIndex + 1, pagination.pageSize, debouncedFilter, selectedGymId, selectedLocationId],
    queryFn: async () =>
      (
        await axios.post("/api/equipment/getequipments", {
          page: pagination.pageIndex + 1,
          limit: pagination.pageSize,
          search: debouncedFilter,
          gym_id: selectedGymId || undefined,
          location_id: selectedLocationId || undefined,
          today: startOfDay(new Date()).toISOString(),
        })
      ).data,
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
  if (session?.user?.role !== "GYM_OWNER" && session?.user?.role !== "STAFF") return redirect("/unauthorized");

  const createAction = can("equipment.create") ? (
    <Button
      disabled={!selectedGymId}
      onClick={() => (!isSubscriptionActive || subscriptionExpired ? setShowExpiredModal(true) : setAdding(true))}
    >
      <Plus aria-hidden /> Add equipment
    </Button>
  ) : undefined;

  const overdue = data?.overdueCount ?? 0;
  const dueSoon = data?.dueSoonCount ?? 0;

  return (
    <PageContainer>
      <PageHeader
        title="Equipment"
        description="Machines and gear at this branch, and when they're due for maintenance."
        actions={createAction}
      />

      {!selectedGymId ? (
        <div className="mb-4 rounded-md bg-muted p-4">
          <p className="text-sm text-muted-foreground">Choose a gym and branch at the top of the page to see equipment.</p>
        </div>
      ) : (
        <>
          {(overdue > 0 || dueSoon > 0) && (
            <p
              role="status"
              className={
                overdue > 0
                  ? "mb-4 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                  : "mb-4 flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100"
              }
            >
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                {[
                  overdue > 0 && `${plural(overdue, "item")} overdue for maintenance`,
                  dueSoon > 0 && `${plural(dueSoon, "item")} due in the next ${MAINTENANCE_SOON_DAYS} days`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                . They&apos;re at the top of the list.
              </span>
            </p>
          )}

          {error ? (
            <DataFetchError error={error} onRetry={() => refetch()} message="Couldn't load equipment" />
          ) : (
            <DataTable
              columns={columns}
              data={data?.data ?? []}
              isLoading={isLoading && !data}
              mobileCard={(item) => <EquipmentCard key={item.id} item={item} />}
              searchPlaceholder="Search by name or type"
              searchableColumns={["name"]}
              isSearching={!!debouncedFilter.trim()}
              emptyMessage="No equipment yet"
              emptyDescription="Keep track of machines and weights, their condition and when they need maintenance."
              emptyAction={createAction}
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

      <EquipmentDialog
        open={adding}
        onClose={() => setAdding(false)}
        gymId={selectedGymId}
        locationId={selectedLocationId}
        onLimit={(info) => setLimit(info)}
      />
      <SubscriptionLimitModal
        open={!!limit}
        onClose={() => setLimit(null)}
        limitInfo={{ resourceType: "equipment", current: limit?.current ?? 0, max: limit?.max ?? 0 }}
      />
      <SubscriptionExpiredModal open={showExpiredModal} onClose={() => setShowExpiredModal(false)} />
    </PageContainer>
  );
};

export default EquipmentPage;
