"use client";

import Link from "next/link";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import FullScreenLoader from "@/components/common/FullScreenLoader";
import DataFetchError from "@/components/common/DataFetchError";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { StaffList, type StaffRow } from "@/components/staff/StaffList";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type StaffResponse = { data: StaffRow[]; seats: { used: number; max: number; planActive: boolean } };

const StaffPage = () => {
  const { data: session, status } = useSession({ required: true });
  const isOwner = session?.user?.role === "GYM_OWNER";

  const { data, isLoading, error, refetch } = useQuery<StaffResponse>({
    queryKey: ["staff"],
    queryFn: async () => (await axios.post("/api/staff/getstaff", {})).data,
    enabled: status === "authenticated" && isOwner,
  });

  if (status === "loading") return <FullScreenLoader />;
  if (!isOwner) return redirect("/unauthorized");

  const seats = data?.seats;
  // Why the owner can't invite, if they can't: no active plan, a plan without
  // staff logins, or every seat taken.
  const blockedReason = !seats
    ? null
    : !seats.planActive
      ? "no-plan"
      : seats.max === 0
        ? "no-staff-on-plan"
        : seats.used >= seats.max
          ? "seats-full"
          : null;

  return (
    <PageContainer>
      <PageHeader
        title="Staff"
        description={
          <>
            Give front-desk staff their own login and choose exactly what they can see and do.
            {seats?.planActive && seats.max > 0 && (
              <span className="mt-1 block">
                {seats.used} of {seats.max} seats used
              </span>
            )}
          </>
        }
        actions={
          blockedReason ? (
            <Button disabled>
              <Plus aria-hidden /> Invite staff
            </Button>
          ) : (
            <Button asChild>
              <Link href="/staff/manage">
                <Plus aria-hidden /> Invite staff
              </Link>
            </Button>
          )
        }
      />

      {blockedReason === "no-plan" && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-semibold text-destructive">No active plan</p>
          <p className="mt-1 text-muted-foreground">
            Your plan has expired or isn&apos;t active yet, so you can&apos;t invite staff. Contact support to renew.
          </p>
        </div>
      )}
      {blockedReason === "no-staff-on-plan" && (
        <div className="mb-4 rounded-md bg-muted p-4 text-sm text-muted-foreground">
          Your plan doesn&apos;t include staff logins. Upgrade your plan to invite staff.
        </div>
      )}
      {blockedReason === "seats-full" && (
        <div className="mb-4 rounded-md bg-muted p-4 text-sm text-muted-foreground">
          You&apos;ve used all {seats!.max} staff seats on your plan. Deactivate someone to free a seat, or upgrade your plan.
        </div>
      )}

      {isLoading && !data && <FullScreenLoader label="Loading staff..." />}
      {error && <DataFetchError error={error} onRetry={() => refetch()} message="Error loading staff" />}

      {data && data.data.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No staff yet</CardTitle>
            <CardDescription>
              Invite your receptionist or trainer by email. They&apos;ll get a link to set their own password, and
              won&apos;t see revenue or billing unless you allow it.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {data && data.data.length > 0 && <StaffList staff={data.data} />}
    </PageContainer>
  );
};

export default StaffPage;
