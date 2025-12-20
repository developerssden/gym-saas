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
import { useMemo, useState, Suspense } from "react";
import { toast } from "sonner";
import { useSubscriptionValidation } from "@/hooks/useSubscriptionValidation";
import { SubscriptionLimitModal } from "@/components/subscription/SubscriptionLimitModal";

type OwnerOption = { id: string; first_name: string; last_name: string; email?: string | null };

const GymSchema = Yup.object({
  owner_id: Yup.string().required("Owner is required"),
  name: Yup.string().required("Gym name is required"),
  phone_number: Yup.string().notRequired(),
  address: Yup.string().notRequired(),
  city: Yup.string().notRequired(),
  state: Yup.string().notRequired(),
  zip_code: Yup.string().notRequired(),
  country: Yup.string().notRequired(),
});

const ManageGymContent = () => {
  const { data: session, status } = useSession({ required: true });
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const action = (searchParams?.get("action") as "create" | "edit" | "view") || "create";
  const gymId = searchParams?.get("id") || null;

  const [saving, setSaving] = useState(false);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [limitInfo, setLimitInfo] = useState<any>(null);

  const isSuperAdmin = status === "authenticated" && session?.user?.role === "SUPER_ADMIN";
  const isGymOwner = status === "authenticated" && session?.user?.role === "GYM_OWNER";
  const isAuthorized = isSuperAdmin || isGymOwner;

  const { isSubscriptionActive, subscriptionLimits, subscriptionExpired } =
    useSubscriptionValidation();

  if (status === "loading") return <FullScreenLoader />;
  if (!isAuthorized) return redirect("/unauthorized");

  const { data: gymData, isLoading: fetchingGym } = useQuery({
    queryKey: ["gym", gymId],
    queryFn: async () => {
      if (!gymId) return null;
      const res = await axios.post("/api/gyms/getgym", { id: gymId });
      return res.data;
    },
    enabled: isAuthorized && !!gymId && action !== "create",
  });

  // Owners dropdown: reuse clients API (GYM_OWNER users)
  const { data: ownersData, isLoading: ownersLoading } = useQuery({
    queryKey: ["ownersDropdown"],
    queryFn: async () => {
      const res = await axios.post("/api/clients/getclients", { page: 1, limit: 500, search: "" });
      return res.data as { data: OwnerOption[] };
    },
    enabled: isSuperAdmin,
  });

  const owners = useMemo(() => ownersData?.data ?? [], [ownersData]);

  const ownerLabelById = useMemo(() => {
    const map = new Map<string, string>();
    owners.forEach((o) => {
      map.set(o.id, `${o.first_name} ${o.last_name}`.trim() + (o.email ? ` (${o.email})` : ""));
    });
    return map;
  }, [owners]);

  const createMutation = useMutation({
    mutationFn: (values: any) => axios.post("/api/gyms/creategym", values),
    onSuccess: () => {
      toast.success("Gym created successfully");
      queryClient.invalidateQueries({ queryKey: ["gyms"] });
      router.push("/gyms");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: any) => axios.post("/api/gyms/updategym", { id: gymId, ...values }),
    onSuccess: () => {
      toast.success("Gym updated successfully");
      queryClient.invalidateQueries({ queryKey: ["gyms"] });
      router.push("/gyms");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const formik = useFormik({
    initialValues: {
      owner_id: isGymOwner ? session?.user?.id || "" : gymData?.owner_id || "",
      name: gymData?.name || "",
      phone_number: gymData?.phone_number || "",
      address: gymData?.address || "",
      city: gymData?.city || "",
      state: gymData?.state || "",
      zip_code: gymData?.zip_code || "",
      country: gymData?.country || "",
    },
    validationSchema: isGymOwner
      ? Yup.object({
          name: Yup.string().required("Gym name is required"),
          phone_number: Yup.string().notRequired(),
          address: Yup.string().notRequired(),
          city: Yup.string().notRequired(),
          state: Yup.string().notRequired(),
          zip_code: Yup.string().notRequired(),
          country: Yup.string().notRequired(),
        })
      : GymSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      // Check subscription for GYM_OWNER
      if (isGymOwner) {
        if (!isSubscriptionActive) {
          toast.error("Your subscription is expired. Please renew to continue.");
          return;
        }

        // Check limit before creating
        if (action === "create") {
          const currentGyms = subscriptionLimits.max_gyms
            ? await axios
                .post("/api/gyms/getgyms", { page: 1, limit: 1000 })
                .then((res) => res.data.data.length)
                .catch(() => 0)
            : 0;

          if (currentGyms >= subscriptionLimits.max_gyms) {
            setLimitInfo({
              current: currentGyms,
              max: subscriptionLimits.max_gyms,
              resourceType: "gym",
            });
            setLimitModalOpen(true);
            return;
          }
        }
      }

      setSaving(true);
      try {
        if (action === "create") {
          await createMutation.mutateAsync(values);
        } else if (action === "edit") {
          await updateMutation.mutateAsync(values);
        }
      } catch (error: any) {
        // Handle limit exceeded error from API
        if (error?.response?.data?.error === "LIMIT_EXCEEDED") {
          setLimitInfo(error.response.data);
          setLimitModalOpen(true);
        } else if (error?.response?.data?.error === "SUBSCRIPTION_EXPIRED") {
          toast.error("Your subscription is expired. Please renew to continue.");
        }
      } finally {
        setSaving(false);
      }
    },
  });

  if (fetchingGym) return <FullScreenLoader label="Loading gym..." />;

  return (
    <PageContainer>
      {saving && <FullScreenLoader label="Saving gym..." />}
      <div className="w-full space-y-12">
        <h1 className="h1 text-center">
          {action === "create" ? "Create Gym" : action === "edit" ? "Edit Gym" : "View Gym"}
        </h1>

        <form className="max-w-2xl mx-auto" onSubmit={formik.handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            {isSuperAdmin && (
              <div className="space-y-2 md:col-span-2">
                <Label>Owner *</Label>
                <Select
                  value={formik.values.owner_id || ""}
                  onValueChange={(val) => formik.setFieldValue("owner_id", val)}
                  disabled={action === "view" || ownersLoading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={ownersLoading ? "Loading..." : "Select owner"} />
                  </SelectTrigger>
                  <SelectContent>
                    {owners.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {ownerLabelById.get(o.id) || o.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formik.touched.owner_id && formik.errors.owner_id && (
                  <p className="text-red-500 text-sm">{String(formik.errors.owner_id)}</p>
                )}
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label>Gym Name *</Label>
              <Input
                name="name"
                value={formik.values.name}
                onChange={formik.handleChange}
                disabled={action === "view"}
                placeholder="Enter gym name"
              />
              {formik.touched.name && formik.errors.name && (
                <p className="text-red-500 text-sm">{String(formik.errors.name)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                name="phone_number"
                value={formik.values.phone_number}
                onChange={formik.handleChange}
                disabled={action === "view"}
                placeholder="Phone number (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label>Country</Label>
              <Input
                name="country"
                value={formik.values.country}
                onChange={formik.handleChange}
                disabled={action === "view"}
                placeholder="Country (optional)"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Address</Label>
              <Input
                name="address"
                value={formik.values.address}
                onChange={formik.handleChange}
                disabled={action === "view"}
                placeholder="Address (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label>City</Label>
              <Input
                name="city"
                value={formik.values.city}
                onChange={formik.handleChange}
                disabled={action === "view"}
                placeholder="City (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label>State</Label>
              <Input
                name="state"
                value={formik.values.state}
                onChange={formik.handleChange}
                disabled={action === "view"}
                placeholder="State (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label>Zip Code</Label>
              <Input
                name="zip_code"
                value={formik.values.zip_code}
                onChange={formik.handleChange}
                disabled={action === "view"}
                placeholder="Zip code (optional)"
              />
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            {action !== "view" ? (
              <>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={
                    (isGymOwner && (!isSubscriptionActive || subscriptionExpired))
                  }
                >
                  {action === "create" ? "Create Gym" : "Update Gym"}
                </Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => router.push("/gyms")}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" className="w-full" onClick={() => router.push("/gyms")}>
                Back
              </Button>
            )}
          </div>
        </form>
      </div>
      {limitInfo && (
        <SubscriptionLimitModal
          open={limitModalOpen}
          onClose={() => setLimitModalOpen(false)}
          limitInfo={limitInfo}
          planName={session?.user?.subscription_limits ? "Current Plan" : undefined}
        />
      )}
    </PageContainer>
  );
};

const ManageGymPage = () => {
  return (
    <Suspense fallback={<FullScreenLoader label="Loading..." />}>
      <ManageGymContent />
    </Suspense>
  );
};

export default ManageGymPage;

