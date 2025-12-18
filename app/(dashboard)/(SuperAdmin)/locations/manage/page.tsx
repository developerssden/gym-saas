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
import { useMemo, useState } from "react";
import { toast } from "sonner";

type GymOption = {
  id: string;
  name: string;
  owner?: { first_name?: string; last_name?: string; email?: string | null };
};

const LocationSchema = Yup.object({
  gym_id: Yup.string().required("Gym is required"),
  name: Yup.string().required("Location name is required"),
  phone_number: Yup.string().notRequired(),
  address: Yup.string().notRequired(),
  city: Yup.string().notRequired(),
  state: Yup.string().notRequired(),
  zip_code: Yup.string().notRequired(),
  country: Yup.string().notRequired(),
});

const ManageLocationPage = () => {
  const { data: session, status } = useSession({ required: true });
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const action =
    (searchParams?.get("action") as "create" | "edit" | "view") || "create";
  const locationId = searchParams?.get("id") || null;

  const [saving, setSaving] = useState(false);
  const isSuperAdmin =
    status === "authenticated" && session?.user?.role === "SUPER_ADMIN";

  const { data: locationData, isLoading: fetchingLocation } = useQuery({
    queryKey: ["location", locationId],
    queryFn: async () => {
      if (!locationId) return null;
      const res = await axios.post("/api/locations/getlocation", {
        id: locationId,
      });
      return res.data;
    },
    enabled: isSuperAdmin && !!locationId && action !== "create",
  });

  // Gym dropdown
  const { data: gymsData, isLoading: gymsLoading } = useQuery({
    queryKey: ["gymsDropdown"],
    queryFn: async () => {
      const res = await axios.post("/api/gyms/getgyms", {});
      return res.data as { data: GymOption[] };
    },
    enabled: isSuperAdmin,
  });

  const gyms = useMemo(() => gymsData?.data ?? [], [gymsData]);

  const gymLabelById = useMemo(() => {
    const map = new Map<string, string>();
    gyms.forEach((g) => {
      const owner = g.owner;
      const ownerLabel = owner
        ? `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim()
        : "";
      map.set(
        g.id,
        `${g.name}${ownerLabel ? ` — ${ownerLabel}` : ""}` +
          (owner?.email ? ` (${owner.email})` : "")
      );
    });
    return map;
  }, [gyms]);

  const createMutation = useMutation({
    mutationFn: (values: any) =>
      axios.post("/api/locations/createlocation", values),
    onSuccess: () => {
      toast.success("Location created successfully");
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      router.push("/locations");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: any) =>
      axios.post("/api/locations/updatelocation", {
        id: locationId,
        ...values,
      }),
    onSuccess: () => {
      toast.success("Location updated successfully");
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      router.push("/locations");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const formik = useFormik({
    initialValues: {
      gym_id: locationData?.gym_id || "",
      name: locationData?.name || "",
      phone_number: locationData?.phone_number || "",
      address: locationData?.address || "",
      city: locationData?.city || "",
      state: locationData?.state || "",
      zip_code: locationData?.zip_code || "",
      country: locationData?.country || "",
    },
    validationSchema: LocationSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setSaving(true);
      try {
        if (action === "create") {
          await createMutation.mutateAsync(values);
        } else if (action === "edit") {
          await updateMutation.mutateAsync(values);
        }
      } finally {
        setSaving(false);
      }
    },
  });

  if (status === "loading") return <FullScreenLoader />;
  if (!isSuperAdmin) return redirect("/unauthorized");
  if (fetchingLocation) return <FullScreenLoader label="Loading location..." />;

  return (
    <PageContainer>
      {saving && <FullScreenLoader label="Saving location..." />}
      <div className="w-full space-y-12">
        <h1 className="h1 text-center">
          {action === "create"
            ? "Create Location"
            : action === "edit"
            ? "Edit Location"
            : "View Location"}
        </h1>

        <form className="max-w-2xl mx-auto" onSubmit={formik.handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            <div className="space-y-2 md:col-span-2">
              <Label>Gym *</Label>
              <Select
                value={formik.values.gym_id || ""}
                onValueChange={(val) => formik.setFieldValue("gym_id", val)}
                disabled={action === "view" || gymsLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={gymsLoading ? "Loading..." : "Select gym"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {gyms.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {gymLabelById.get(g.id) || g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formik.touched.gym_id && formik.errors.gym_id && (
                <p className="text-red-500 text-sm">
                  {String(formik.errors.gym_id)}
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Location Name *</Label>
              <Input
                name="name"
                value={formik.values.name}
                onChange={formik.handleChange}
                disabled={action === "view"}
                placeholder="Enter location name"
              />
              {formik.touched.name && formik.errors.name && (
                <p className="text-red-500 text-sm">
                  {String(formik.errors.name)}
                </p>
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
                <Button type="submit" className="flex-1">
                  {action === "create" ? "Create Location" : "Update Location"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push("/locations")}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.push("/locations")}
              >
                Back
              </Button>
            )}
          </div>
        </form>
      </div>
    </PageContainer>
  );
};

export default ManageLocationPage;
