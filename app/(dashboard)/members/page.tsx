"use client";

import FullScreenLoader from "@/components/common/FullScreenLoader";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import Link from "next/link";
import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import DataFetchError from "@/components/common/DataFetchError";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useSubscriptionValidation } from "@/hooks/useSubscriptionValidation";
import { usePermissions } from "@/hooks/usePermissions";
import { columns } from "@/components/members/columns";
import { SubscriptionExpiredModal } from "@/components/subscription/SubscriptionExpiredModal";

const MembersPage = () => {
  const { data: session, status } = useSession({ required: true });
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedFilter = useDebounce(globalFilter, 400);
  const { isSubscriptionActive, subscriptionExpired } = useSubscriptionValidation();
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const { can } = usePermissions();

  const selectedGymId = session?.user?.selected_gym_id;
  const selectedLocationId = session?.user?.selected_location_id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "members",
      pagination.pageIndex + 1,
      pagination.pageSize,
      debouncedFilter,
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
      });
      return res.data;
    },
    enabled: status === "authenticated" && (session?.user?.role === "GYM_OWNER" || session?.user?.role === "STAFF") && !!selectedGymId,
  });

  if (status === "loading") {
    return <FullScreenLoader />;
  }
  if (session?.user?.role !== "GYM_OWNER" && session?.user?.role !== "STAFF") {
    return redirect("/unauthorized");
  }

  const memberActions = !can("members.create") && !can("members.import") ? null : !isSubscriptionActive || subscriptionExpired ? (
          <Button onClick={() => setShowExpiredModal(true)}>
            Create Member
          </Button>
        ) : (
          <div className="flex gap-2">
            {can("members.import") && (
              <Link href="/members/import">
                <Button variant="outline">Import from Excel</Button>
              </Link>
            )}
            {can("members.create") && (
              <Link href={`/members/manage?action=create`}>
                <Button>Create Member</Button>
              </Link>
            )}
          </div>
        );

  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-6">
        <h1 className="h1">Members</h1>
        {memberActions}
      </div>

      {!selectedGymId && (
        <div className="mb-4 p-4 bg-muted rounded-md">
          <p className="text-sm text-muted-foreground">
            Please select a gym and location from the header to view members.
          </p>
        </div>
      )}

      {isLoading && !data && (
        <div className="flex justify-center items-center h-64">
          <FullScreenLoader label="Loading Members..." />
        </div>
      )}

      {error && (
        <DataFetchError
          error={error}
          onRetry={() => refetch()}
          message="Error loading members"
        />
      )}

      {data && (
        <DataTable
          columns={columns}
          data={data.data}
          searchPlaceholder="Search by name, phone or email"
          searchableColumns={["user.first_name", "user.last_name", "user.email", "user.phone_number"]}
          emptyMessage="No members yet"
          emptyDescription="Import your member list from Excel in one go, or add members one by one."
          emptyAction={memberActions}
          searchEmptyDescription="Try part of their name or phone number, e.g. 0301 234."
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

export default MembersPage;

