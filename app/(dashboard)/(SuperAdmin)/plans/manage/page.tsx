/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { PageContainer } from "@/components/layout/page-container";
import { useRouter, useSearchParams } from "next/navigation";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import axios from "axios";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import { useState, Suspense } from "react";

const SubscriptionSchema = Yup.object({
  name: Yup.string().required("Name is required"),
  monthly_price: Yup.number()
    .typeError("Must be a number")
    .required("Monthly price is required"),
  yearly_price: Yup.number()
    .typeError("Must be a number")
    .required("Yearly price is required"),
  max_gyms: Yup.number()
    .typeError("Must be a number")
    .required("Max gyms is required"),
  max_locations: Yup.number()
    .typeError("Must be a number")
    .required("Max locations is required"),
  max_members: Yup.number()
    .typeError("Must be a number")
    .required("Max members is required"),
  max_equipment: Yup.number()
    .typeError("Must be a number")
    .required("Max equipment is required"),
  is_active: Yup.boolean(),
});

const ManageSubscriptionsContent = () => {
  const searchParams = useSearchParams();
  const action = searchParams?.get("action") as "create" | "edit" | "view";
  const subscriptionId = searchParams?.get("id") || null;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const { data: subscriptionData, isLoading: fetching } = useQuery({
    queryKey: ["plan", subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) return null;
      const res = await axios.post(`/api/plans/getplan`, {
        id: subscriptionId,
      });
      return res.data;
    },
    enabled: !!subscriptionId && action !== "create", // only fetch if editing or viewing
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (values) => axios.post("/api/plans/createplan", values),
    onSuccess: (res) => {
      toast.success(res.data.message || "Plan created successfully!");
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      router.push("/plans");
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: any) =>
      axios.post(`/api/plans/updateplan`, { id: subscriptionId, ...values }),
    onSuccess: (res) => {
      toast.success(res.data.message || "Plan updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      router.push("/plans");
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err));
    },
  });

  const formik = useFormik({
    initialValues: {
      name: subscriptionData?.name || "",
      monthly_price: subscriptionData?.monthly_price || "",
      yearly_price: subscriptionData?.yearly_price || "",
      max_gyms: subscriptionData?.max_gyms || "",
      max_locations: subscriptionData?.max_locations || "",
      max_members: subscriptionData?.max_members || "",
      max_equipment: subscriptionData?.max_equipment || "",
      is_active: subscriptionData?.is_active || true,
    },

    validationSchema: SubscriptionSchema,
    enableReinitialize: true,

    onSubmit: async (values) => {
      setLoading(true);
      try {
        if (action === "create") {
          await createMutation.mutateAsync(values as any);
        } else if (action === "edit") {
          await updateMutation.mutateAsync(values as any);
        }
      } finally {
        setLoading(false);
      }
    },
  });

  if (fetching) return <FullScreenLoader label="Loading plan..." />;

  return (
    <PageContainer>
      {loading && <FullScreenLoader label="Saving plan..." />}
      <div className="w-full space-y-12">
        <h1 className="h1 text-center">
          {action === "create"
            ? "Create Plan"
            : action === "edit"
            ? "Edit Plan"
            : "View Plan"}
        </h1>
        <form className="max-w-2xl mx-auto" onSubmit={formik.handleSubmit}>
          <div className=" grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            {/* Name */}
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                name="name"
                value={formik.values.name}
                onChange={formik.handleChange}
                disabled={action === "view"}
              />
              {formik.errors.name === "string" && (
                <p className="text-red-500 text-sm">{formik.errors.name}</p>
              )}
            </div>

            {/* Monthly Price */}
            <div className="space-y-1">
              <Label>Monthly Price</Label>
              <Input
                name="monthly_price"
                type="number"
                value={formik.values.monthly_price}
                onChange={formik.handleChange}
                disabled={action === "view"}
              />
              {formik.errors.monthly_price === "string" && (
                <p className="text-red-500 text-sm">
                  {formik.errors.monthly_price}
                </p>
              )}
            </div>

            {/* Yearly Price */}
            <div className="space-y-1">
              <Label>Yearly Price</Label>
              <Input
                name="yearly_price"
                type="number"
                value={formik.values.yearly_price}
                onChange={formik.handleChange}
                disabled={action === "view"}
              />
              {formik.errors.yearly_price === "string" && (
                <p className="text-red-500 text-sm">
                  {formik.errors.yearly_price}
                </p>
              )}
            </div>

            {/* Max Gyms */}
            <div className="space-y-1">
              <Label>Max Gyms</Label>
              <Input
                name="max_gyms"
                type="number"
                value={formik.values.max_gyms}
                onChange={formik.handleChange}
                disabled={action === "view"}
              />
              {formik.errors.max_gyms === "string" && (
                <p className="text-red-500 text-sm">{formik.errors.max_gyms}</p>
              )}
            </div>

            {/* Max Members */}
            <div className="space-y-1">
              <Label>Max Members</Label>
              <Input
                name="max_members"
                type="number"
                value={formik.values.max_members}
                onChange={formik.handleChange}
                disabled={action === "view"}
              />
              {formik.errors.max_members === "string" && (
                <p className="text-red-500 text-sm">
                  {formik.errors.max_members}
                </p>
              )}
            </div>

            {/* Max Locations */}
            <div className="space-y-1">
              <Label>Max Locations</Label>
              <Input
                name="max_locations"
                type="number"
                value={formik.values.max_locations}
                onChange={formik.handleChange}
                disabled={action === "view"}
              />
              {formik.errors.max_locations === "string" && (
                <p className="text-red-500 text-sm">{formik.errors.max_locations}</p>
              )}
            </div>

            {/* Max Equipment */}
            <div className="space-y-1">
              <Label>Max Equipment</Label>
              <Input
                name="max_equipment"
                type="number"
                value={formik.values.max_equipment}
                onChange={formik.handleChange}
                disabled={action === "view"}
              />
              {formik.errors.max_equipment === "string" && (
                <p className="text-red-500 text-sm">
                  {formik.errors.max_equipment}
                </p>
              )}
            </div>

            {/* Active / Inactive */}
            <div className="flex items-center space-x-3">
              <Label>Active</Label>
              <Switch
                checked={formik.values.is_active}
                onCheckedChange={(val) =>
                  formik.setFieldValue("is_active", val)
                }
                disabled={action === "view"}
              />
            </div>
          </div>

          {action !== "view" && (
            <Button type="submit" className="w-full mt-4">
              {action === "create" ? "Create Plan" : "Update Plan"}
            </Button>
          )}
          {(action === "edit" || action === "create") && (
            <Button
              type="button"
              variant="outline"
              className="w-full mt-4"
              onClick={() => router.push("/plans")}
            >
              Cancel
            </Button>
          )}
          {action === "view" && (
            <Button
              type="button"
              variant="outline"
              className="w-full mt-4"
              onClick={() => router.push("/plans")}
            >
              Back
            </Button>
          )}
        </form>
      </div>
    </PageContainer>
  );
};

const ManageSubscriptions = () => {
  return (
    <Suspense fallback={<FullScreenLoader label="Loading..." />}>
      <ManageSubscriptionsContent />
    </Suspense>
  );
};

export default ManageSubscriptions;
