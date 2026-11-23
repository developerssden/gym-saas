"use client";

import FullScreenLoader from "@/components/common/FullScreenLoader";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/hooks/usePermissions";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import Link from "next/link";
import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import DataFetchError from "@/components/common/DataFetchError";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { columns } from "@/components/todos/columns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TodosPage = () => {
  const { data: session, status } = useSession({ required: true });
  const { can } = usePermissions();
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "pending">("all");
  const debouncedFilter = useDebounce(globalFilter, 400);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["todos", pagination.pageIndex + 1, pagination.pageSize, debouncedFilter, statusFilter],
    queryFn: async () => {
      const res = await axios.post("/api/todos/gettodos", {
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        is_completed: statusFilter === "all" ? undefined : statusFilter === "completed",
      });
      return res.data;
    },
    enabled: status === "authenticated" && (session?.user?.role === "GYM_OWNER" || session?.user?.role === "STAFF"),
  });

  if (status === "loading") {
    return <FullScreenLoader />;
  }
  if (session?.user?.role !== "GYM_OWNER" && session?.user?.role !== "STAFF") {
    return redirect("/unauthorized");
  }

  return (
    <PageContainer>
      <PageHeader
        title="To-dos"
        description="Jobs to remember for the gym."
        actions={
          can("todos.create") ? (
            <Button asChild>
              <Link href={`/todos/manage?action=create`}>
                <Plus aria-hidden /> Add to-do
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex gap-4 mb-4">
        <Select value={statusFilter} onValueChange={(value: "all" | "completed" | "pending") => setStatusFilter(value)}>
          <SelectTrigger className="h-11 w-full sm:w-[180px] md:h-9" aria-label="Filter by status">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All to-dos</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && !data && (
        <div className="flex justify-center items-center h-64">
          <FullScreenLoader label="Loading Todos..." />
        </div>
      )}

      {error && (
        <DataFetchError
          error={error}
          onRetry={() => refetch()}
          message="Error loading todos"
        />
      )}

      {data && (
        <DataTable
          columns={columns}
          data={data.data}
          searchPlaceholder="Search to-dos"
          searchableColumns={["title", "description"]}
          emptyMessage={statusFilter === "all" ? "No to-dos yet" : statusFilter === "completed" ? "No completed to-dos" : "Nothing pending"}
          emptyDescription={statusFilter === "all" ? "Note jobs for the gym, like fixing a machine or paying a bill." : undefined}
          emptyAction={
            statusFilter === "all" && can("todos.create") ? (
              <Link href={`/todos/manage?action=create`}>
                <Button>Create Todo</Button>
              </Link>
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
    </PageContainer>
  );
};

export default TodosPage;

