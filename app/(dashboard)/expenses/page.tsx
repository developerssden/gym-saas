"use client";

import { useState } from "react";
import axios from "axios";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/hooks/usePermissions";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import DataFetchError from "@/components/common/DataFetchError";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { CashBook } from "@/components/expenses/CashBook";
import ExpenseDialog, { type ExpenseRow } from "@/components/expenses/ExpenseDialog";
import { ExpenseCard, columns } from "@/components/expenses/columns";

type ExpensesResponse = { data: ExpenseRow[]; totalCount: number; pageCount: number };

const ExpensesPage = () => {
  const { data: session, status } = useSession({ required: true });
  const { can } = usePermissions();
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedFilter = useDebounce(globalFilter, 400);
  const [adding, setAdding] = useState(false);

  const selectedGymId = session?.user?.selected_gym_id;
  const selectedLocationId = session?.user?.selected_location_id;

  const { data, isLoading, error, refetch } = useQuery<ExpensesResponse>({
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
    // Keep the list (and the search box) on screen while the next page or search loads.
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

  const canAdd = can("expenses.create");
  const addButton = (
    <Button onClick={() => setAdding(true)} disabled={!selectedGymId}>
      <Plus aria-hidden /> Add expense
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader
        title="Expenses"
        description="Rent, bills, salaries and repairs. Profit = collected − expenses."
        actions={canAdd ? addButton : undefined}
      />

      {!selectedGymId ? (
        <div className="mb-4 rounded-md bg-muted p-4">
          <p className="text-sm text-muted-foreground">Choose a gym and branch at the top of the page to see expenses.</p>
        </div>
      ) : (
        <>
          {can("expenses.cashbook") && <CashBook gymId={selectedGymId} locationId={selectedLocationId} />}

          {error ? (
            <DataFetchError error={error} onRetry={() => refetch()} message="Couldn't load expenses" />
          ) : (
            <DataTable
              columns={columns}
              data={data?.data ?? []}
              isLoading={isLoading && !data}
              mobileCard={(expense) => <ExpenseCard key={expense.id} expense={expense} />}
              searchableColumns={["category", "note"]}
              searchPlaceholder="Search by category or note"
              isSearching={!!debouncedFilter.trim()}
              emptyMessage="No expenses yet"
              emptyDescription="Add rent, bills and salaries to see your real profit."
              emptyAction={canAdd ? addButton : undefined}
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
