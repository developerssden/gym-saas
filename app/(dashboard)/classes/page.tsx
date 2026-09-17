"use client";

import FullScreenLoader from "@/components/common/FullScreenLoader";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import DataFetchError from "@/components/common/DataFetchError";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { CATEGORY_LABELS, columns, DAY_LABELS, type ClassRow } from "@/components/classes/columns";
import { useSubscriptionValidation } from "@/hooks/useSubscriptionValidation";
import { SubscriptionExpiredModal } from "@/components/subscription/SubscriptionExpiredModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const ALL = "__all__";

const ClassesPage = () => {
  const { data: session, status } = useSession({ required: true });
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [globalFilter, setGlobalFilter] = useState("");
  const [category, setCategory] = useState(ALL);
  const debouncedFilter = useDebounce(globalFilter, 1000);
  const { isSubscriptionActive, subscriptionExpired } = useSubscriptionValidation();
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  const selectedGymId = session?.user?.selected_gym_id;
  const selectedLocationId = session?.user?.selected_location_id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "classes",
      pagination.pageIndex + 1,
      pagination.pageSize,
      debouncedFilter,
      selectedGymId,
      selectedLocationId,
      category,
    ],
    queryFn: async () => {
      const res = await axios.post("/api/classes/getclasses", {
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: debouncedFilter,
        gym_id: selectedGymId || undefined,
        location_id: selectedLocationId || undefined,
        category: category === ALL ? undefined : category,
      });
      return res.data;
    },
    enabled: status === "authenticated" && session?.user?.role === "GYM_OWNER" && !!selectedGymId,
  });

  const grouped = useMemo(() => {
    const rows = (data?.data ?? []) as ClassRow[];
    const map = new Map<string, ClassRow[]>();
    for (const row of rows) {
      const key = row.day_of_week || "UNSCHEDULED";
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return map;
  }, [data]);

  if (status === "loading") {
    return <FullScreenLoader />;
  }
  if (session?.user?.role !== "GYM_OWNER") {
    return redirect("/unauthorized");
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
        <h1 className="h1">Classes</h1>
        <div className="flex gap-2">
          <Link href="/classes/attendance">
            <Button variant="outline">Attendance</Button>
          </Link>
          {!isSubscriptionActive || subscriptionExpired ? (
            <Button onClick={() => setShowExpiredModal(true)}>Create Class</Button>
          ) : (
            <Link href={`/classes/manage?action=create`}>
              <Button disabled={!selectedGymId}>Create Class</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="mb-4 max-w-xs space-y-1">
        <Label>Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedGymId && (
        <div className="mb-4 p-4 bg-muted rounded-md">
          <p className="text-sm text-muted-foreground">
            Please select a gym from the header to view classes.
          </p>
        </div>
      )}

      {isLoading && !data && (
        <div className="flex justify-center items-center h-64">
          <FullScreenLoader label="Loading Classes..." />
        </div>
      )}

      {error && (
        <DataFetchError error={error} onRetry={() => refetch()} message="Error loading classes" />
      )}

      {data && grouped.size > 0 && (
        <div className="mb-6 space-y-4">
          {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY", "UNSCHEDULED"].map(
            (day) => {
              const rows = grouped.get(day);
              if (!rows?.length) return null;
              return (
                <div key={day}>
                  <h2 className="text-sm font-semibold mb-2">
                    {day === "UNSCHEDULED" ? "Unscheduled" : DAY_LABELS[day]}
                  </h2>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {rows.map((c) => (
                      <li key={c.id}>
                        {c.start_time ? `${c.start_time} ` : ""}
                        {c.name} ({CATEGORY_LABELS[c.category] || c.category})
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }
          )}
        </div>
      )}

      {data && (
        <DataTable
          columns={columns}
          data={data.data}
          searchableColumns={["name"]}
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

export default ClassesPage;
