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
import { columns } from "@/components/members/columns";
import { SubscriptionExpiredModal } from "@/components/subscription/SubscriptionExpiredModal";

const MembersPage = () => {
  const { data: session, status } = useSession({ required: true });
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedFilter = useDebounce(globalFilter, 1000);
  const { isSubscriptionActive, subscriptionExpired } = useSubscriptionValidation();
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["members", pagination.pageIndex + 1, pagination.pageSize, debouncedFilter],
    queryFn: async () => {
      const res = await axios.post("/api/members/getmembers", {
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: debouncedFilter,
      });
      return res.data;
    },
    enabled: status === "authenticated" && session?.user?.role === "GYM_OWNER",
  });

  if (status === "loading") {
    return <FullScreenLoader />;
  }
  if (session?.user?.role !== "GYM_OWNER") {
    return redirect("/unauthorized");
  }

  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-6">
        <h1 className="h1">Members</h1>
        {!isSubscriptionActive || subscriptionExpired ? (
          <Button onClick={() => setShowExpiredModal(true)}>
            Create Member
          </Button>
        ) : (
          <Link href={`/members/manage?action=create`}>
            <Button>Create Member</Button>
          </Link>
        )}
      </div>

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
          searchableColumns={["user.first_name", "user.last_name", "user.email", "user.phone_number"]}
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

