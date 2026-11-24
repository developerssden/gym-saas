"use client";

import { Suspense, useState } from "react";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import FullScreenLoader from "@/components/common/FullScreenLoader";
import { PageContainer } from "@/components/layout/page-container";
import { StickyFormFooter } from "@/components/forms/sticky-form-footer";
import { PermissionMatrix } from "@/components/staff/PermissionMatrix";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { DEFAULT_STAFF_PERMISSIONS, normalizePermissions } from "@/lib/staff-permissions";

type StaffDetail = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  staff_gym_id: string | null;
  staff_permissions: string[];
  status: "active" | "invited" | "deactivated";
};

type FormState = {
  first_name: string;
  last_name: string;
  email: string;
  gym_id: string;
  permissions: string[];
};

const ManageStaffContent = () => {
  const { data: session, status } = useSession({ required: true });
  const searchParams = useSearchParams();
  const staffId = searchParams?.get("id") || null;
  const isEdit = !!staffId;
  const isOwner = session?.user?.role === "GYM_OWNER";
  const gyms = session?.user?.gyms ?? [];

  const { data: staff, isLoading } = useQuery<StaffDetail>({
    queryKey: ["staff", staffId],
    queryFn: async () => (await axios.post("/api/staff/getstaff", { id: staffId })).data.data,
    enabled: isEdit && status === "authenticated" && isOwner,
  });

  if (status === "loading" || (isEdit && isLoading)) return <FullScreenLoader />;
  if (!isOwner) return redirect("/unauthorized");

  // The form is seeded once from the loaded record (edit) or defaults (invite).
  const initial: FormState = staff
    ? {
        first_name: staff.first_name ?? "",
        last_name: staff.last_name ?? "",
        email: staff.email ?? "",
        gym_id: staff.staff_gym_id ?? "",
        permissions: staff.staff_permissions,
      }
    : {
        first_name: "",
        last_name: "",
        email: "",
        gym_id: session?.user?.selected_gym_id || gyms[0]?.id || "",
        permissions: DEFAULT_STAFF_PERMISSIONS,
      };

  return (
    <StaffForm
      key={staff?.id ?? "new"}
      staffId={staffId}
      initial={initial}
      gyms={gyms}
    />
  );
};

function StaffForm({
  staffId,
  initial,
  gyms,
}: {
  staffId: string | null;
  initial: FormState;
  gyms: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = !!staffId;
  const [form, setForm] = useState<FormState>(initial);

  const save = useMutation({
    mutationFn: () => {
      const permissions = normalizePermissions(form.permissions);
      return isEdit
        ? axios.post("/api/staff/updatestaff", {
            id: staffId,
            first_name: form.first_name,
            last_name: form.last_name,
            gym_id: form.gym_id,
            permissions,
          })
        : axios.post("/api/staff/invitestaff", {
            first_name: form.first_name,
            last_name: form.last_name,
            email: form.email,
            gym_id: form.gym_id,
            permissions,
          });
    },
    onSuccess: () => {
      toast.success(isEdit ? "Permissions saved" : `Invite sent to ${form.email}`);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      router.push("/staff");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const name = [form.first_name, form.last_name].filter(Boolean).join(" ");

  return (
    <PageContainer>
      <form
        className="flex flex-col gap-6"
        onSubmit={e => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div>
          <h1 className="h1">{isEdit ? `Permissions for ${name || "staff member"}` : "Invite staff"}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit
              ? "Changes apply the next time they open a page."
              : "They'll get an email with a link to set their own password."}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">First name</Label>
              <Input
                id="first_name"
                value={form.first_name}
                onChange={e => setForm(prev => ({ ...prev, first_name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last name (optional)</Label>
              <Input
                id="last_name"
                value={form.last_name}
                onChange={e => setForm(prev => ({ ...prev, last_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                required
                disabled={isEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gym_id">Works at</Label>
              <Select value={form.gym_id} onValueChange={gym_id => setForm(prev => ({ ...prev, gym_id }))}>
                <SelectTrigger id="gym_id" className="w-full" aria-describedby="gym_id-hint">
                  <SelectValue placeholder="Choose a gym" />
                </SelectTrigger>
                <SelectContent>
                  {gyms.map(gym => (
                    <SelectItem key={gym.id} value={gym.id}>
                      {gym.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p id="gym_id-hint" className="text-xs text-muted-foreground">They only see this gym and its locations.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What they can see and do</CardTitle>
            <CardDescription>
              Gyms, locations, billing and staff are always owner-only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PermissionMatrix
              value={form.permissions}
              onChange={permissions => setForm(prev => ({ ...prev, permissions }))}
              disabled={save.isPending}
            />
          </CardContent>
        </Card>

        <StickyFormFooter className="mt-0">
          <Button type="button" variant="outline" onClick={() => router.push("/staff")}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending || !form.gym_id}>
            {save.isPending ? "Saving..." : isEdit ? "Save permissions" : "Send invite"}
          </Button>
        </StickyFormFooter>
      </form>
    </PageContainer>
  );
}

export default function ManageStaffPage() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <ManageStaffContent />
    </Suspense>
  );
}
