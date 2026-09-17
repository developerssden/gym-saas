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
import { CATEGORY_LABELS, DAY_LABELS } from "@/components/classes/columns";

const ClassSchema = Yup.object({
  name: Yup.string().required("Name is required"),
  category: Yup.string().required("Category is required"),
  description: Yup.string(),
  instructor_id: Yup.string(),
  day_of_week: Yup.string(),
  start_time: Yup.string(),
  end_time: Yup.string(),
  duration_minutes: Yup.number().min(0).nullable(),
  capacity: Yup.number().min(0).nullable(),
  location_id: Yup.string(),
});

const NONE = "__none__";

const ManageClassContent = () => {
  const { data: session, status } = useSession({ required: true });
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const action = (searchParams?.get("action") as "create" | "edit" | "view") || "create";
  const classId = searchParams?.get("id") || null;

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

  const { data: classData, isLoading: loadingClass } = useQuery({
    queryKey: ["class", classId],
    queryFn: async () => {
      const res = await axios.post("/api/classes/getclass", { id: classId });
      return res.data;
    },
    enabled: !!classId && (action === "edit" || action === "view"),
  });

  const { data: staffList } = useQuery({
    queryKey: ["staff", "instructors", selectedGymId],
    queryFn: async () => {
      const res = await axios.post("/api/staff/getstaffs", {
        page: 1,
        limit: 200,
        gym_id: selectedGymId,
      });
      return res.data.data as Array<{
        id: string;
        first_name: string;
        last_name: string | null;
      }>;
    },
    enabled: !!selectedGymId,
  });

  const createMutation = useMutation({
    mutationFn: async (values: any) => axios.post("/api/classes/createclass", values),
    onSuccess: () => {
      toast.success("Class created successfully");
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      router.push("/classes");
    },
    onError: (err: any) => {
      if (err.response?.data?.limitExceeded) {
        setLimitExceeded({
          show: true,
          resourceType: "class",
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
      axios.post("/api/classes/updateclass", { id: classId, ...values }),
    onSuccess: () => {
      toast.success("Class updated successfully");
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["class", classId] });
      router.push("/classes");
    },
    onError: (err: any) => {
      if (err.response?.data?.limitExceeded) {
        setLimitExceeded({
          show: true,
          resourceType: "class",
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
      name: classData?.name || "",
      category: classData?.category || "OTHER",
      description: classData?.description || "",
      instructor_id: classData?.instructor_id || "",
      day_of_week: classData?.day_of_week || "",
      start_time: classData?.start_time || "",
      end_time: classData?.end_time || "",
      duration_minutes: classData?.duration_minutes ?? "",
      capacity: classData?.capacity ?? "",
      location_id: classData?.location_id || selectedLocationId || "",
    },
    validationSchema: ClassSchema,
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
          gym_id: classData?.gym_id || selectedGymId,
          instructor_id: values.instructor_id || null,
          day_of_week: values.day_of_week || null,
          location_id: values.location_id || null,
          duration_minutes: values.duration_minutes === "" ? null : values.duration_minutes,
          capacity: values.capacity === "" ? null : values.capacity,
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

  if (status === "loading" || loadingClass) {
    return <FullScreenLoader />;
  }
  if (session?.user?.role !== "GYM_OWNER") {
    return redirect("/unauthorized");
  }

  const isView = action === "view";

  return (
    <PageContainer>
      {saving && <FullScreenLoader label="Saving class..." />}
      <div className="w-full space-y-8">
        <h1 className="h1 text-center">
          {action === "create" ? "Create Class" : action === "edit" ? "Edit Class" : "View Class"}
        </h1>
        <form className="max-w-2xl mx-auto space-y-4" onSubmit={formik.handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <Label>Name</Label>
              <Input
                name="name"
                value={formik.values.name}
                onChange={formik.handleChange}
                disabled={isView}
              />
              {typeof formik.errors.name === "string" && (
                <p className="text-red-500 text-sm">{formik.errors.name}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select
                value={formik.values.category}
                onValueChange={(v) => formik.setFieldValue("category", v)}
                disabled={isView}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Instructor</Label>
              <Select
                value={formik.values.instructor_id || NONE}
                onValueChange={(v) =>
                  formik.setFieldValue("instructor_id", v === NONE ? "" : v)
                }
                disabled={isView}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {(staffList ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {`${s.first_name} ${s.last_name ?? ""}`.trim()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Day</Label>
              <Select
                value={formik.values.day_of_week || NONE}
                onValueChange={(v) =>
                  formik.setFieldValue("day_of_week", v === NONE ? "" : v)
                }
                disabled={isView}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unscheduled" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Unscheduled</SelectItem>
                  {Object.entries(DAY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Location (optional)</Label>
              <Select
                value={formik.values.location_id || NONE}
                onValueChange={(v) =>
                  formik.setFieldValue("location_id", v === NONE ? "" : v)
                }
                disabled={isView}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Gym-wide" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Gym-wide</SelectItem>
                  {gymLocations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Start time</Label>
              <Input
                name="start_time"
                type="time"
                value={formik.values.start_time}
                onChange={formik.handleChange}
                disabled={isView}
              />
            </div>
            <div className="space-y-1">
              <Label>End time</Label>
              <Input
                name="end_time"
                type="time"
                value={formik.values.end_time}
                onChange={formik.handleChange}
                disabled={isView}
              />
            </div>
            <div className="space-y-1">
              <Label>Duration (minutes)</Label>
              <Input
                name="duration_minutes"
                type="number"
                value={formik.values.duration_minutes}
                onChange={formik.handleChange}
                disabled={isView}
              />
            </div>
            <div className="space-y-1">
              <Label>Capacity</Label>
              <Input
                name="capacity"
                type="number"
                value={formik.values.capacity}
                onChange={formik.handleChange}
                disabled={isView}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Description</Label>
              <Textarea
                name="description"
                value={formik.values.description}
                onChange={formik.handleChange}
                disabled={isView}
              />
            </div>
          </div>

          {action !== "view" && (
            <Button type="submit" className="w-full mt-4" disabled={!selectedGymId && action === "create"}>
              {action === "create" ? "Create Class" : "Update Class"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => router.push("/classes")}
          >
            {action === "view" ? "Back" : "Cancel"}
          </Button>
        </form>
      </div>

      <SubscriptionLimitModal
        open={limitExceeded.show}
        onClose={() => setLimitExceeded({ show: false })}
        limitInfo={{
          resourceType: limitExceeded.resourceType || "class",
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

const ManageClass = () => (
  <Suspense fallback={<FullScreenLoader label="Loading..." />}>
    <ManageClassContent />
  </Suspense>
);

export default ManageClass;
