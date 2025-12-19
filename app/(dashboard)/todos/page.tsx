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
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "pending">("all");
  const debouncedFilter = useDebounce(globalFilter, 1000);

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
        <h1 className="h1">Todos</h1>
        <Link href={`/todos/manage?action=create`}>
          <Button>Create Todo</Button>
        </Link>
      </div>

      <div className="flex gap-4 mb-4">
        <Select value={statusFilter} onValueChange={(value: "all" | "completed" | "pending") => setStatusFilter(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Todos</SelectItem>
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
          searchableColumns={["title", "description"]}
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

