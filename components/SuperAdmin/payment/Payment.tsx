"use client";

import { useState } from "react";
import Link from "next/link";
import { Session } from "next-auth";
import { useSession } from "next-auth/react";
import { Plus } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import DataFetchError from "@/components/common/DataFetchError";
import QuickPaymentDialog from "@/components/payments/QuickPaymentDialog";
import { PaymentCard, columns as gymColumns, paymentMemberHref } from "@/components/payments/columns";
import { PendingPaymentsList } from "@/components/offline/PendingPaymentsList";
import { useDebounce } from "@/hooks/use-debounce";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import { usePayments } from "@/hooks/use-payments";
import { usePermissions } from "@/hooks/usePermissions";
import { useOutbox } from "@/hooks/useOffline";
import { PAYMENT_PERIODS, PERIOD_TOTAL_LABEL, periodRange, type PaymentPeriod } from "@/lib/payments/period";
import { cn } from "@/lib/utils";
import { columns as adminColumns } from "./columns";

type Method = "all" | "CASH" | "BANK_TRANSFER";

const EMPTY: Record<PaymentPeriod, string> = {
  today: "Nothing collected today yet",
  week: "Nothing collected this week yet",
  month: "Nothing collected this month yet",
  all: "No payments yet",
  custom: "No payments in these dates",
};

const Payments = ({ session }: { session: Session }) => {
  const isAdmin = session.user.role === "SUPER_ADMIN";
  return isAdmin ? <AdminPayments /> : <GymPayments />;
};

/** Owners and staff: what members paid, filtered by date and method, with a total. */
function GymPayments() {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [period, setPeriod] = useState<PaymentPeriod>("today");
  const [custom, setCustom] = useState<{ from?: string; to?: string }>({});
  const [method, setMethod] = useState<Method>("all");
  const [quickOpen, setQuickOpen] = useState(false);
  const { can } = usePermissions();
  const { format } = useGymCurrency();
  const outbox = useOutbox();
  // The branch switcher updates the client session, so read the branch from it.
  const { data: session } = useSession();
  const gymId = session?.user?.selected_gym_id || undefined;
  const locationId = session?.user?.selected_location_id || undefined;

  const range = periodRange(period, new Date(), custom);
  // Wait for both dates before filtering by a custom range.
  const customIncomplete = period === "custom" && (!custom.from || !custom.to);

  const { data, isLoading, error, refetch } = usePayments({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    search: debouncedSearch,
    gym_id: gymId,
    location_id: locationId,
    date_from: customIncomplete ? undefined : range.from,
    date_to: customIncomplete ? undefined : range.to,
    payment_method: method === "all" ? undefined : method,
  });

  const toFirstPage = () => setPagination((p) => ({ ...p, pageIndex: 0 }));
  const canRecord = can("payments.record") || can("membersubscriptions.renew");
  const recordButton = canRecord ? (
    <Button onClick={() => setQuickOpen(true)}>
      <Plus aria-hidden /> Record payment
    </Button>
  ) : undefined;

  return (
    <PageContainer>
      <PageHeader title="Payments" description="Fees your members paid, with receipts to share." actions={recordButton} />

      {outbox.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="font-medium">Waiting to sync ({outbox.length})</p>
          <p className="text-sm text-muted-foreground">
            Recorded on this device while offline. They&apos;re sent automatically when the connection is back.
          </p>
          <PendingPaymentsList items={outbox} />
        </div>
      )}

      <div role="group" aria-label="Show payments from" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {PAYMENT_PERIODS.map((p) => {
          const selected = period === p.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setPeriod(p.id);
                toFirstPage();
              }}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors md:min-h-9",
                selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {period === "custom" && (
        <div className="mb-3 grid grid-cols-2 gap-3 sm:flex sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="payments-from">From</Label>
            <Input
              id="payments-from"
              type="date"
              className="h-11 md:h-9"
              value={custom.from ?? ""}
              onChange={(e) => {
                setCustom((c) => ({ ...c, from: e.target.value || undefined }));
                toFirstPage();
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="payments-to">To</Label>
            <Input
              id="payments-to"
              type="date"
              className="h-11 md:h-9"
              value={custom.to ?? ""}
              onChange={(e) => {
                setCustom((c) => ({ ...c, to: e.target.value || undefined }));
                toFirstPage();
              }}
            />
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ToggleGroup
          type="single"
          variant="outline"
          aria-label="Paid by"
          value={method}
          onValueChange={(v) => {
            if (!v) return;
            setMethod(v as Method);
            toFirstPage();
          }}
          className="w-full sm:w-auto"
        >
          <ToggleGroupItem value="all" className="h-11 flex-1 px-4 md:h-9">All</ToggleGroupItem>
          <ToggleGroupItem value="CASH" className="h-11 flex-1 px-4 md:h-9">Cash</ToggleGroupItem>
          <ToggleGroupItem value="BANK_TRANSFER" className="h-11 flex-1 px-4 md:h-9">Bank transfer</ToggleGroupItem>
        </ToggleGroup>

        <div className="rounded-lg border bg-card px-4 py-3 sm:text-right" aria-live="polite">
          <p className="text-sm text-muted-foreground">
            {customIncomplete ? "Collected in total" : PERIOD_TOTAL_LABEL[period]}
            {method !== "all" && ` (${method === "CASH" ? "cash" : "bank transfer"})`}
          </p>
          {data ? (
            <p className="text-2xl font-semibold tabular-nums text-primary">
              {format(data.totalAmount)}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {data.totalCount} {data.totalCount === 1 ? "payment" : "payments"}
              </span>
            </p>
          ) : (
            <Skeleton className="mt-1 h-8 w-32 sm:ml-auto" />
          )}
        </div>
      </div>

      {error ? (
        <DataFetchError error={error} onRetry={() => refetch()} message="Couldn't load payments" />
      ) : (
        <DataTable
          columns={gymColumns}
          data={data?.data ?? []}
          isLoading={isLoading && !data}
          mobileCard={(row) => <PaymentCard key={row.id} payment={row} />}
          getRowHref={paymentMemberHref}
          searchableColumns={["member"]}
          searchPlaceholder="Search by member name, phone or transaction ID"
          isSearching={!!debouncedSearch.trim()}
          emptyMessage={EMPTY[customIncomplete ? "all" : period]}
          emptyDescription="Record a member's fee and it shows up here, with a receipt you can share on WhatsApp."
          emptyAction={recordButton}
          searchEmptyDescription="Try part of their name or phone number, e.g. 0301 234."
          pageCount={data?.pageCount ?? 1}
          rowCount={data?.totalCount}
          onPaginationChange={setPagination}
          onSearchChange={(value) => {
            setSearch(value);
            toFirstPage();
          }}
          pagination={pagination}
          searchValue={search}
        />
      )}

      <QuickPaymentDialog open={quickOpen} onClose={() => setQuickOpen(false)} />
    </PageContainer>
  );
}

/** Super admin: gym owners' payments for their plans. */
function AdminPayments() {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const { data, isLoading, error, refetch } = usePayments({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    search: debouncedSearch,
  });

  return (
    <PageContainer>
      <PageHeader
        title="Payments"
        description="Payments from gym owners for their plans."
        actions={
          <Button asChild>
            <Link href="/payments/manage?action=create">
              <Plus aria-hidden /> Add payment
            </Link>
          </Button>
        }
      />
      {error ? (
        <DataFetchError error={error} onRetry={() => refetch()} message="Couldn't load payments" />
      ) : (
        <DataTable
          columns={adminColumns}
          data={data?.data ?? []}
          isLoading={isLoading && !data}
          searchableColumns={["subscription"]}
          emptyMessage="No payments yet"
          pageCount={data?.pageCount ?? 1}
          rowCount={data?.totalCount}
          onPaginationChange={setPagination}
          onSearchChange={(value) => {
            setSearch(value);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
          pagination={pagination}
          searchValue={search}
          isSearching={!!debouncedSearch.trim()}
          searchPlaceholder="Search by owner name, email or transaction ID"
        />
      )}
    </PageContainer>
  );
}

export default Payments;
