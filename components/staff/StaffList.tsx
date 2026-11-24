"use client";

import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, ShieldCheck, UserCheck, UserX, XCircle } from "lucide-react";

import { useConfirm } from "@/components/common/confirm-dialog";
import { ListCard } from "@/components/common/list-card";
import { RowActions } from "@/components/common/row-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { ALL_PERMISSIONS } from "@/lib/staff-permissions";
import { cn } from "@/lib/utils";

export type StaffRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  status: "active" | "invited" | "deactivated";
  staff_permissions: string[];
  staff_gym: { id: string; name: string } | null;
};

const chip = "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

// Lime = can sign in, amber = waiting on them, muted = switched off.
const STATUS: Record<StaffRow["status"], { label: string; className: string }> = {
  active: { label: "Active", className: "bg-status-active text-status-active-foreground" },
  invited: { label: "Invite sent", className: "bg-amber-500/15 text-amber-800 dark:text-amber-300" },
  deactivated: { label: "Deactivated", className: "bg-muted text-muted-foreground" },
};

export const staffName = (s: StaffRow) => [s.first_name, s.last_name].filter(Boolean).join(" ");

function StatusChip({ status }: { status: StaffRow["status"] }) {
  const s = STATUS[status];
  return <span className={cn(chip, s.className)}>{s.label}</span>;
}

const permissionsText = (s: StaffRow) => `${s.staff_permissions.length} of ${ALL_PERMISSIONS.length} permissions`;

function StaffActions({ staff, className }: { staff: StaffRow; className?: string }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["staff"] });
  const { confirm, dialog: confirmDialog } = useConfirm();
  const name = staffName(staff);
  const who = name || staff.email || "This staff member";
  const firstName = staff.first_name || who;

  const update = useMutation({
    mutationFn: (is_active: boolean) => axios.post("/api/staff/updatestaff", { id: staff.id, is_active }),
    onSuccess: (_res, isActive) => {
      toast.success(isActive ? `${who} can sign in again` : `${who} is deactivated`);
      refresh();
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
  const resend = useMutation({
    mutationFn: () => axios.post("/api/staff/resendinvite", { id: staff.id }),
    onSuccess: () => toast.success(`Invite sent again${staff.email ? ` to ${staff.email}` : ""}`),
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

  const askDeactivate = async () => {
    const ok = await confirm({
      title: `Deactivate ${who}?`,
      description: `${firstName} won't be able to sign in until you reactivate them. Their seat is freed for someone else.`,
      confirmLabel: "Deactivate",
      cancelLabel: "Keep active",
      destructive: true,
    });
    if (ok) update.mutate(false);
  };

  const askCancel = async () => {
    const ok = await confirm({
      title: "Cancel this invite?",
      description: `The link we emailed${staff.email ? ` to ${staff.email}` : ""} will stop working. You can invite them again later.`,
      confirmLabel: "Cancel invite",
      cancelLabel: "Keep invite",
      destructive: true,
    });
    if (ok) cancel.mutate();
  };

  return (
    <>
      {confirmDialog}
      <RowActions
        className={className}
        visible={staff.status === "active" ? 1 : 2}
        moreLabel={`More actions for ${who}`}
        actions={[
          {
            label: "Reactivate",
            icon: UserCheck,
            onClick: () => update.mutate(true),
            loading: update.isPending,
            hidden: staff.status !== "deactivated",
          },
          {
            label: "Resend invite",
            icon: Mail,
            onClick: () => resend.mutate(),
            loading: resend.isPending,
            hidden: staff.status !== "invited",
          },
          { label: "Permissions", icon: ShieldCheck, href: `/staff/manage?id=${staff.id}` },
          {
            label: "Cancel invite",
            icon: XCircle,
            destructive: true,
            onClick: askCancel,
            loading: cancel.isPending,
            hidden: staff.status !== "invited",
          },
          {
            label: "Deactivate",
            icon: UserX,
            destructive: true,
            onClick: askDeactivate,
            loading: update.isPending,
            hidden: staff.status !== "active",
          },
        ]}
      />
    </>
  );
}

/** Cards on phones, a table from md up. The list is short (one per staff seat), so no paging. */
export function StaffList({ staff }: { staff: StaffRow[] }) {
  return (
    <Card className="py-0">
      <CardContent className="p-0">
        <ul className="md:hidden">
          {staff.map(s => (
            <ListCard
              key={s.id}
              title={staffName(s) || s.email || "Staff member"}
              subtitle={staffName(s) ? s.email : undefined}
              status={<StatusChip status={s.status} />}
              meta={[s.staff_gym?.name, permissionsText(s)].filter(Boolean).join(" · ")}
              actions={<StaffActions staff={s} />}
            />
          ))}
        </ul>

        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Works at</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map(s => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{staffName(s) || "—"}</div>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </TableCell>
                  <TableCell>{s.staff_gym?.name ?? "—"}</TableCell>
                  <TableCell>
                    <StatusChip status={s.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.staff_permissions.length} of {ALL_PERMISSIONS.length}
                  </TableCell>
                  <TableCell>
                    <StaffActions staff={s} className="justify-end" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
