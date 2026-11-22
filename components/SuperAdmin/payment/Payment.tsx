"use client";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Session } from "next-auth";
import Link from "next/link";
import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import DataFetchError from "@/components/common/DataFetchError";
import { usePayments } from "@/hooks/use-payments";
import { usePermissions } from "@/hooks/usePermissions";
import QuickPaymentDialog from "@/components/payments/QuickPaymentDialog";
import { columns } from "./columns";

const Payments = ({ session }: { session: Session }) => {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedFilter = useDebounce(globalFilter, 1000);
  const { can, isGymUser } = usePermissions();
  const [quickOpen, setQuickOpen] = useState(false);

  // Use the hook
  const { data, isLoading, error, refetch } = usePayments({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    enabled: true,
  });

  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-6">
        <h1 className="h1">Payments</h1>
        {(session.user.role === "SUPER_ADMIN" || can("payments.record")) && (
          <Link href={`/payments/manage?action=create`}>
            <Button>Create Payment</Button>
          </Link>
        )}
      </div>

      {isLoading && !data && (
        <div className="flex justify-center items-center h-64">
          <FullScreenLoader label="Loading Payments..." />
        </div>
      )}

      {error && (
        <DataFetchError
          error={error}
          onRetry={() => refetch()}
          message="Error loading payments"
        />
      )}

      {data && (
        <DataTable
          columns={columns}
          data={data.data}
          searchableColumns={["transaction_id"]}
          emptyMessage="No payments yet"
          emptyDescription={
            isGymUser
              ? "Record a member's fee and it shows up here, with a receipt you can share on WhatsApp."
              : undefined
          }
          emptyAction={
            isGymUser && can("payments.record") ? (
              <Button onClick={() => setQuickOpen(true)}>Record payment</Button>
            ) : undefined
          }
          pageCount={data.pageCount}
          rowCount={data.totalCount}
          onPaginationChange={setPagination}
          onSearchChange={setGlobalFilter}
          pagination={pagination}
          searchValue={globalFilter}
        />
      )}
      {isGymUser && <QuickPaymentDialog open={quickOpen} onClose={() => setQuickOpen(false)} />}
    </PageContainer>
  );
};

export default Payments;

