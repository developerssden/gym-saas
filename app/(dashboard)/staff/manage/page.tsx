/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import FullScreenLoader from "@/components/common/FullScreenLoader";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useState, Suspense } from "react";
import { toast } from "sonner";
import { useSubscriptionValidation } from "@/hooks/useSubscriptionValidation";
import { SubscriptionLimitModal } from "@/components/subscription/SubscriptionLimitModal";
import { SubscriptionExpiredModal } from "@/components/subscription/SubscriptionExpiredModal";

const StaffSchema = Yup.object({
  first_name: Yup.string().required("First name is required"),
  last_name: Yup.string(),
  role: Yup.string().required("Role is required"),
  specialization: Yup.string(),
  phone_number: Yup.string(),
  email: Yup.string().email("Invalid email"),
  shift_notes: Yup.string(),
  location_id: Yup.string(),
});

const STAFF_ROLES = [
  { value: "MANAGER", label: "Manager" },
  { value: "TRAINER", label: "Trainer" },
  { value: "INSTRUCTOR", label: "Instructor" },
  { value: "FRONT_DESK", label: "Front desk" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "OTHER", label: "Other" },
];

const NONE_LOCATION = "__none__";

const ManageStaffContent = () => {
  const { data: session, status } = useSession({ required: true });
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const action = (searchParams?.get("action") as "create" | "edit" | "view") || "create";
  const staffId = searchParams?.get("id") || null;

  const [saving, setSaving] = useState(false);
  const { isSubscriptionActive, subscriptionExpired } = useSubscriptionValidation();
  const [limitExceeded, setLimitExceeded] = useState<{
    show: boolean;
    resourceType?: string;
    current?: number;
    max?: number;
  }>({ show: false });
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  const selectedGymId = session?.user?.selected_gym_id;
  const selectedLocationId = session?.user?.selected_location_id;
  const gymLocations = (session?.user?.locations ?? []).filter(
    (loc) => loc.gymId === selectedGymId
  );

  const { data: staffData, isLoading: loadingStaff } = useQuery({
    queryKey: ["staff", staffId],
    queryFn: async () => {
      const res = await axios.post("/api/staff/getstaff", { id: staffId });
      return res.data;
    },
    enabled: !!staffId && (action === "edit" || action === "view"),
  });

  const createMutation = useMutation({
    mutationFn: async (values: any) => axios.post("/api/staff/createstaff", values),
    onSuccess: () => {
      toast.success("Staff created successfully");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      router.push("/staff");
    },
    onError: (err: any) => {
      if (err.response?.data?.limitExceeded) {
        setLimitExceeded({
          show: true,
          resourceType: "staff",
          current: err.response.data.current,
          max: err.response.data.max,
        });
      } else {
        toast.error(getErrorMessage(err));
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: any) =>
      axios.post("/api/staff/updatestaff", { id: staffId, ...values }),
    onSuccess: () => {
      toast.success("Staff updated successfully");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["staff", staffId] });
      router.push("/staff");
    },
    onError: (err: any) => {
      if (err.response?.data?.limitExceeded) {
        setLimitExceeded({
          show: true,
          resourceType: "staff",
          current: err.response.data.current,
          max: err.response.data.max,
        });
      } else {
        toast.error(getErrorMessage(err));
      }
    },
  });

  const formik = useFormik({
    initialValues: {
      first_name: staffData?.first_name || "",
      last_name: staffData?.last_name || "",
      role: staffData?.role || "OTHER",
      specialization: staffData?.specialization || "",
      phone_number: staffData?.phone_number || "",
      email: staffData?.email || "",
      shift_notes: staffData?.shift_notes || "",
      location_id: staffData?.location_id || selectedLocationId || "",
    },
    validationSchema: StaffSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      if (action === "create" && (!isSubscriptionActive || subscriptionExpired)) {
        setShowExpiredModal(true);
        return;
      }
      setSaving(true);
      try {
        const payload = {
          ...values,
          gym_id: staffData?.gym_id || selectedGymId,
          location_id: values.location_id || null,
        };
        if (action === "create") {
          await createMutation.mutateAsync(payload);
        } else if (action === "edit") {
          await updateMutation.mutateAsync(payload);
        }
      } finally {
        setSaving(false);
      }
    },
  });

  if (status === "loading" || loadingStaff) {
    return <FullScreenLoader />;
  }
  if (session?.user?.role !== "GYM_OWNER") {
    return redirect("/unauthorized");
  }

  const isView = action === "view";

  return (
    <PageContainer>
      {saving && <FullScreenLoader label="Saving staff..." />}
      <div className="w-full space-y-8">
        <h1 className="h1 text-center">
          {action === "create" ? "Create Staff" : action === "edit" ? "Edit Staff" : "View Staff"}
        </h1>
        <form className="max-w-2xl mx-auto space-y-4" onSubmit={formik.handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>First name</Label>
              <Input
                name="first_name"
                value={formik.values.first_name}
                onChange={formik.handleChange}
                disabled={isView}
              />
              {typeof formik.errors.first_name === "string" && (
                <p className="text-red-500 text-sm">{formik.errors.first_name}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Last name</Label>
              <Input
                name="last_name"
                value={formik.values.last_name}
                onChange={formik.handleChange}
                disabled={isView}
              />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select
                value={formik.values.role}
                onValueChange={(v) => formik.setFieldValue("role", v)}
                disabled={isView}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Location (optional)</Label>
              <Select
                value={formik.values.location_id || NONE_LOCATION}
                onValueChange={(v) =>
                  formik.setFieldValue("location_id", v === NONE_LOCATION ? "" : v)
                }
                disabled={isView}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Gym-wide" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_LOCATION}>Gym-wide</SelectItem>
                  {gymLocations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Specialization</Label>
              <Input
                name="specialization"
                value={formik.values.specialization}
                onChange={formik.handleChange}
                disabled={isView}
                placeholder="Yoga, Zumba, Strength Training"
              />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input
                name="phone_number"
                value={formik.values.phone_number}
                onChange={formik.handleChange}
                disabled={isView}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Email</Label>
              <Input
                name="email"
                type="email"
                value={formik.values.email}
                onChange={formik.handleChange}
                disabled={isView}
              />
              {typeof formik.errors.email === "string" && (
                <p className="text-red-500 text-sm">{formik.errors.email}</p>
              )}
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Shift notes</Label>
              <Textarea
                name="shift_notes"
                value={formik.values.shift_notes}
                onChange={formik.handleChange}
                disabled={isView}
                placeholder="Mon-Fri 6am-2pm"
              />
            </div>
          </div>

          {action !== "view" && (
            <Button type="submit" className="w-full mt-4" disabled={!selectedGymId && action === "create"}>
              {action === "create" ? "Create Staff" : "Update Staff"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => router.push("/staff")}
          >
            {action === "view" ? "Back" : "Cancel"}
          </Button>
        </form>
      </div>

      <SubscriptionLimitModal
        open={limitExceeded.show}
        onClose={() => setLimitExceeded({ show: false })}
        limitInfo={{
          resourceType: limitExceeded.resourceType || "staff",
          current: limitExceeded.current || 0,
          max: limitExceeded.max || 0,
        }}
      />
      <SubscriptionExpiredModal
        open={showExpiredModal}
        onClose={() => setShowExpiredModal(false)}
      />
    </PageContainer>
  );
};

const ManageStaff = () => (
  <Suspense fallback={<FullScreenLoader label="Loading..." />}>
    <ManageStaffContent />
  </Suspense>
);

export default ManageStaff;
