"use client";

import { useState } from "react";
import axios from "axios";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import DataFetchError from "@/components/common/DataFetchError";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { useDebounce } from "@/hooks/use-debounce";
import { CashBook } from "@/components/expenses/CashBook";
import ExpenseDialog from "@/components/expenses/ExpenseDialog";
import { columns } from "@/components/expenses/columns";

const ExpensesPage = () => {
  const { data: session, status } = useSession({ required: true });
  const { can } = usePermissions();
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedFilter = useDebounce(globalFilter, 800);
  const [adding, setAdding] = useState(false);

  const selectedGymId = session?.user?.selected_gym_id;
  const selectedLocationId = session?.user?.selected_location_id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "expenses",
      pagination.pageIndex + 1,
      pagination.pageSize,
      debouncedFilter,
      selectedGymId,
      selectedLocationId,
    ],
    queryFn: async () => {
      const res = await axios.post("/api/expenses/getexpenses", {
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

  if (status === "loading") return <FullScreenLoader />;
  if (session?.user?.role !== "GYM_OWNER" && session?.user?.role !== "STAFF") return redirect("/unauthorized");

  return (
    <PageContainer>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="h1">Expenses</h1>
          <p className="text-sm text-muted-foreground">Rent, bills, salaries and repairs. Profit = collected − expenses.</p>
        </div>
        {can("expenses.create") && (
          <Button onClick={() => setAdding(true)} disabled={!selectedGymId} className="h-11">
            <Plus className="size-4" /> Add expense
          </Button>
        )}
      </div>

      {!selectedGymId ? (
        <div className="mb-4 rounded-md bg-muted p-4">
          <p className="text-sm text-muted-foreground">
            Please select a gym and location from the header to see expenses.
          </p>
        </div>
      ) : (
        can("expenses.cashbook") && <CashBook gymId={selectedGymId} locationId={selectedLocationId} />
      )}

      {isLoading && !data && selectedGymId && (
        <div className="flex h-64 items-center justify-center">
          <FullScreenLoader label="Loading expenses..." />
        </div>
      )}

      {error && <DataFetchError error={error} onRetry={() => refetch()} message="Error loading expenses" />}

      {data && (
        <DataTable
          columns={columns}
          data={data.data}
          searchableColumns={["category", "note"]}
          searchPlaceholder="Search by category or note"
          emptyMessage="No expenses yet"
          emptyDescription="Add rent, bills and salaries to see your real profit."
          pageCount={data.pageCount}
          rowCount={data.totalCount}
          onPaginationChange={setPagination}
          onSearchChange={setGlobalFilter}
          pagination={pagination}
          searchValue={globalFilter}
        />
      )}

      <ExpenseDialog
        open={adding}
        onClose={() => setAdding(false)}
        gymId={selectedGymId}
        locationId={selectedLocationId}
      />
    </PageContainer>
  );
};

export default ExpensesPage;
