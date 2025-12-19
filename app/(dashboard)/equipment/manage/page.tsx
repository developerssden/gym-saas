/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import FullScreenLoader from "@/components/common/FullScreenLoader";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useState } from "react";
import { toast } from "sonner";
import { useSubscriptionValidation } from "@/hooks/useSubscriptionValidation";
import { SubscriptionLimitModal } from "@/components/subscription/SubscriptionLimitModal";

const EquipmentSchema = Yup.object({
  name: Yup.string().required("Name is required"),
  type: Yup.string().required("Type is required"),
  quantity: Yup.string().required("Quantity is required"),
  gym_id: Yup.string().required("Gym is required"),
  location_id: Yup.string().notRequired(),
  weight: Yup.string().notRequired(),
});

const ManageEquipmentPage = () => {
  const { data: session, status } = useSession({ required: true });
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const action = (searchParams?.get("action") as "create" | "edit" | "view") || "create";
  const equipmentId = searchParams?.get("id") || null;

  const [saving, setSaving] = useState(false);
  const { isSubscriptionActive, subscriptionExpired } = useSubscriptionValidation();
  const [limitExceeded, setLimitExceeded] = useState<{
    show: boolean;
    resourceType?: string;
    current?: number;
    max?: number;
  }>({ show: false });

  // Get selected gym and location from session
  const selectedGymIdFromSession = session?.user?.selected_gym_id;
  const selectedLocationIdFromSession = session?.user?.selected_location_id;

  // Fetch equipment data
  const { data: equipmentData, isLoading: loadingEquipment } = useQuery({
    queryKey: ["equipment", equipmentId],
    queryFn: async () => {
      const res = await axios.post("/api/equipment/getequipment", { id: equipmentId });
      return res.data;
    },
    enabled: !!equipmentId && (action === "edit" || action === "view"),
  });

  const createMutation = useMutation({
    mutationFn: (values: any) => axios.post("/api/equipment/createequipment", values),
    onSuccess: () => {
      toast.success("Equipment created successfully");
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      router.push("/equipment");
    },
    onError: (err: any) => {
      if (err.response?.data?.limitExceeded) {
        setLimitExceeded({
          show: true,
          resourceType: "equipment",
          current: err.response.data.current,
          max: err.response.data.max,
        });
      } else {
        toast.error(getErrorMessage(err));
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: any) => axios.post("/api/equipment/updateequipment", values),
    onSuccess: () => {
      toast.success("Equipment updated successfully");
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({ queryKey: ["equipment", equipmentId] });
      router.push("/equipment");
    },
    onError: (err: any) => {
      if (err.response?.data?.limitExceeded) {
        setLimitExceeded({
          show: true,
          resourceType: "equipment",
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
      name: equipmentData?.name || "",
      type: equipmentData?.type || "",
      quantity: equipmentData?.quantity || "",
      weight: equipmentData?.weight || "",
      gym_id: equipmentData?.gym_id || selectedGymIdFromSession || "",
      location_id: equipmentData?.location_id || selectedLocationIdFromSession || "",
    },
    validationSchema: EquipmentSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setSaving(true);
      try {
        if (action === "create") {
          // Use session values for create
          await createMutation.mutateAsync({
            ...values,
            gym_id: selectedGymIdFromSession || values.gym_id,
            location_id: selectedLocationIdFromSession || values.location_id || null,
          });
        } else if (action === "edit") {
          await updateMutation.mutateAsync({
            id: equipmentId,
            ...values,
          });
        }
      } finally {
        setSaving(false);
      }
    },
  });

  // Fetch locations based on selected gym (from form or session)
  const currentGymId = formik.values.gym_id || selectedGymIdFromSession || "";
  
  const { data: locationsData } = useQuery({
    queryKey: ["locations", currentGymId],
    queryFn: async () => {
      if (!currentGymId) return { data: [] };
      const res = await axios.post("/api/locations/getlocations", {
        gym_id: currentGymId,
      });
      return res.data;
    },
    enabled: !!currentGymId && status === "authenticated" && action !== "create",
  });

  if (status === "loading" || (loadingEquipment && action !== "create")) {
    return <FullScreenLoader />;
  }
  if (session?.user?.role !== "GYM_OWNER") {
    return redirect("/unauthorized");
  }

  const isViewMode = action === "view";
  const isDisabled = isViewMode || !isSubscriptionActive || subscriptionExpired;

  return (
    <PageContainer>
      <div className="max-w-2xl mx-auto">
        <h1 className="h1 mb-6">
          {action === "create"
            ? "Create Equipment"
            : action === "edit"
            ? "Edit Equipment"
            : "View Equipment"}
        </h1>

        {action === "create" && !selectedGymIdFromSession && (
          <div className="mb-4 p-4 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">
              Please select a gym and location from the header to create equipment.
            </p>
          </div>
        )}

        <form onSubmit={formik.handleSubmit} className="space-y-6">
          {action === "create" ? (
            <>
              {/* When creating, show read-only gym and location from session */}
              <div className="space-y-2">
                <Label>Gym</Label>
                <Input
                  value={
                    session?.user?.gyms?.find((g: any) => g.id === selectedGymIdFromSession)?.name ||
                    "No gym selected"
                  }
                  disabled
                  className="bg-muted"
                />
                <input type="hidden" name="gym_id" value={selectedGymIdFromSession || ""} />
              </div>

              <div className="space-y-2">
                <Label>Location (Optional)</Label>
                <Input
                  value={
                    session?.user?.locations?.find((l: any) => l.id === selectedLocationIdFromSession)?.name ||
                    "No location selected"
                  }
                  disabled
                  className="bg-muted"
                />
                <input type="hidden" name="location_id" value={selectedLocationIdFromSession || ""} />
              </div>
            </>
          ) : (
            <>
              {/* When editing/viewing, allow selection */}
              <div className="space-y-2">
                <Label htmlFor="gym_id">Gym *</Label>
                <Select
                  value={formik.values.gym_id}
                  onValueChange={(value) => {
                    formik.setFieldValue("gym_id", value);
                    formik.setFieldValue("location_id", "");
                  }}
                  disabled={isDisabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a gym" />
                  </SelectTrigger>
                  <SelectContent>
                    {session?.user?.gyms?.map((gym: any) => (
                      <SelectItem key={gym.id} value={gym.id}>
                        {gym.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formik.touched.gym_id && formik.errors.gym_id && (
                  <p className="text-sm text-red-500">{formik.errors.gym_id}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="location_id">Location (Optional)</Label>
                <Select
                  value={formik.values.location_id || ""}
                  onValueChange={(value) => formik.setFieldValue("location_id", value)}
                  disabled={isDisabled || !formik.values.gym_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a location (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {locationsData?.data?.map((location: any) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formik.touched.location_id && formik.errors.location_id && (
                  <p className="text-sm text-red-500">{formik.errors.location_id}</p>
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              value={formik.values.name}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              disabled={isDisabled}
              placeholder="Enter equipment name"
            />
            {formik.touched.name && formik.errors.name && (
              <p className="text-sm text-red-500">{formik.errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type *</Label>
            <Input
              id="type"
              name="type"
              value={formik.values.type}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              disabled={isDisabled}
              placeholder="Enter equipment type"
            />
            {formik.touched.type && formik.errors.type && (
              <p className="text-sm text-red-500">{formik.errors.type}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity *</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              value={formik.values.quantity}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              disabled={isDisabled}
              placeholder="Enter quantity"
            />
            {formik.touched.quantity && formik.errors.quantity && (
              <p className="text-sm text-red-500">{formik.errors.quantity}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="weight">Weight (Optional)</Label>
            <Input
              id="weight"
              name="weight"
              value={formik.values.weight}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              disabled={isDisabled}
              placeholder="Enter weight"
            />
            {formik.touched.weight && formik.errors.weight && (
              <p className="text-sm text-red-500">{formik.errors.weight}</p>
            )}
          </div>

          {!isViewMode && (
            <div className="flex gap-4">
              <Button type="submit" disabled={saving || isDisabled}>
                {saving
                  ? "Saving..."
                  : action === "create"
                  ? "Create Equipment"
                  : "Update Equipment"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          )}

          {isViewMode && (
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Back
            </Button>
          )}
        </form>
      </div>

      <SubscriptionLimitModal
        open={limitExceeded.show}
        onClose={() => setLimitExceeded({ show: false })}
        limitInfo={{
          resourceType: limitExceeded.resourceType || "equipment",
          current: limitExceeded.current || 0,
          max: limitExceeded.max || 0,
        }}
      />
    </PageContainer>
  );
};

export default ManageEquipmentPage;

