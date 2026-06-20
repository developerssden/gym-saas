"use client";

import FullScreenLoader from "@/components/common/FullScreenLoader";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import Link from "next/link";
import { useState, useMemo } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import DataFetchError from "@/components/common/DataFetchError";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useSubscriptionValidation } from "@/hooks/useSubscriptionValidation";
import { columns, type MemberSubscription } from "@/components/membersubscriptions/columns";
import { SubscriptionExpiredModal } from "@/components/subscription/SubscriptionExpiredModal";

const MemberSubscriptionsPage = () => {
  const { data: session, status } = useSession({ required: true });
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedFilter = useDebounce(globalFilter, 1000);
  const { isSubscriptionActive, subscriptionExpired } = useSubscriptionValidation();
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  const selectedGymId = session?.user?.selected_gym_id;
  const selectedLocationId = session?.user?.selected_location_id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "membersubscriptions",
      pagination.pageIndex + 1,
      pagination.pageSize,
      debouncedFilter,
      selectedGymId,
      selectedLocationId,
    ],
    queryFn: async () => {
      const res = await axios.post("/api/membersubscriptions/getmembersubscriptions", {
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: debouncedFilter,
        gym_id: selectedGymId || undefined,
        location_id: selectedLocationId || undefined,
      });
      return res.data;
    },
    enabled: status === "authenticated" && session?.user?.role === "GYM_OWNER" && !!selectedGymId,
  });

  // Client-side only: API returns all subs ordered by createdAt desc;
  // keep first row per member_id (= latest). Pagination totalCount unchanged.
  const latestByMember = useMemo(() => {
    const subs: MemberSubscription[] = data?.data ?? [];
    return Object.values(
      subs.reduce<Record<string, MemberSubscription>>((acc, sub) => {
        if (!acc[sub.member_id]) acc[sub.member_id] = sub;
        return acc;
      }, {})
    );
  }, [data?.data]);

  // Early returns after all hooks
  if (status === "loading") {
    return <FullScreenLoader />;
  }
  if (session?.user?.role !== "GYM_OWNER") {
    return redirect("/unauthorized");
  }

  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-6">
        <h1 className="h1">Member Subscriptions</h1>
        {!isSubscriptionActive || subscriptionExpired ? (
          <Button onClick={() => setShowExpiredModal(true)}>
            Create Subscription
          </Button>
        ) : (
          <Link href={`/membersubscriptions/manage?action=create`}>
            <Button>Create Subscription</Button>
          </Link>
        )}
      </div>

      {!selectedGymId && (
        <div className="mb-4 p-4 bg-muted rounded-md">
          <p className="text-sm text-muted-foreground">
            Please select a gym and location from the header to view member subscriptions.
          </p>
        </div>
      )}

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
          data={latestByMember}
          searchableColumns={[
            "member.user.first_name",
            "member.user.last_name",
            "member.user.email",
          ]}
          pageCount={data.pageCount}
          rowCount={data.totalCount}
          onPaginationChange={setPagination}
          onSearchChange={setGlobalFilter}
          pagination={pagination}
          searchValue={globalFilter}
        />
      )}

      <SubscriptionExpiredModal
        open={showExpiredModal}
        onClose={() => setShowExpiredModal(false)}
      />
    </PageContainer>
  );
};

export default MemberSubscriptionsPage;

