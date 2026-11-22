"use client";

import Link from "next/link";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal, Plus, ShieldCheck, Mail, UserX, UserCheck, XCircle } from "lucide-react";

import FullScreenLoader from "@/components/common/FullScreenLoader";
import DataFetchError from "@/components/common/DataFetchError";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { ALL_PERMISSIONS } from "@/lib/staff-permissions";

type StaffRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  status: "active" | "invited" | "deactivated";
  staff_permissions: string[];
  staff_gym: { id: string; name: string } | null;
};

type StaffResponse = { data: StaffRow[]; seats: { used: number; max: number } };

const STATUS_BADGE: Record<StaffRow["status"], { label: string; variant: "default" | "secondary" | "outline" }> = {
  active: { label: "Active", variant: "default" },
  invited: { label: "Invite sent", variant: "secondary" },
  deactivated: { label: "Deactivated", variant: "outline" },
};

function StaffActions({ staff }: { staff: StaffRow }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["staff"] });

  const update = useMutation({
    mutationFn: (is_active: boolean) => axios.post("/api/staff/updatestaff", { id: staff.id, is_active }),
    onSuccess: (_res, isActive) => {
      toast.success(isActive ? "Staff member reactivated" : "Staff member deactivated");
      refresh();
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
  const resend = useMutation({
    mutationFn: () => axios.post("/api/staff/resendinvite", { id: staff.id }),
    onSuccess: () => toast.success("Invite sent again"),
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
  const cancel = useMutation({
    mutationFn: () => axios.post("/api/staff/cancelinvite", { id: staff.id }),
    onSuccess: () => {
      toast.success("Invite cancelled");
      refresh();
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/staff/manage?id=${staff.id}`}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Edit permissions
          </Link>
        </DropdownMenuItem>
        {staff.status === "invited" && (
          <>
            <DropdownMenuItem onClick={() => resend.mutate()} disabled={resend.isPending}>
              <Mail className="mr-2 h-4 w-4" />
              Resend invite
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              disabled={cancel.isPending}
              onClick={() => {
                if (confirm("Cancel this invite? The link in their email will stop working.")) cancel.mutate();
              }}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel invite
            </DropdownMenuItem>
          </>
        )}
        {staff.status === "active" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              disabled={update.isPending}
              onClick={() => {
                if (confirm("Deactivate this staff member? They lose access straight away and can't sign in until you reactivate them.")) {
                  update.mutate(false);
                }
              }}
            >
              <UserX className="mr-2 h-4 w-4" />
              Deactivate
            </DropdownMenuItem>
          </>
        )}
        {staff.status === "deactivated" && (
          <DropdownMenuItem onClick={() => update.mutate(true)} disabled={update.isPending}>
            <UserCheck className="mr-2 h-4 w-4" />
            Reactivate
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
  const atLimit = !!seats && seats.used >= seats.max;

  return (
    <PageContainer>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="h1">Staff</h1>
          <p className="text-sm text-muted-foreground">
            Give front-desk staff their own login and choose exactly what they can see and do.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {seats && (
            <span className="text-sm text-muted-foreground">
              {seats.used} of {seats.max} seats used
            </span>
          )}
          {atLimit ? (
            <Button disabled title="Your plan's staff limit is reached">
              <Plus className="size-4" /> Invite staff
            </Button>
          ) : (
            <Link href="/staff/manage">
              <Button>
                <Plus className="size-4" /> Invite staff
              </Button>
            </Link>
          )}
        </div>
      </div>

      {atLimit && (
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

      {data && data.data.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Gym</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map(staff => {
                  const name = [staff.first_name, staff.last_name].filter(Boolean).join(" ") || "—";
                  const badge = STATUS_BADGE[staff.status];
                  return (
                    <TableRow key={staff.id}>
                      <TableCell>
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-muted-foreground">{staff.email}</div>
                      </TableCell>
                      <TableCell>{staff.staff_gym?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {staff.staff_permissions.length} of {ALL_PERMISSIONS.length}
                      </TableCell>
                      <TableCell>
                        <StaffActions staff={staff} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
};

export default StaffPage;
