"use client";

import FullScreenLoader from "@/components/common/FullScreenLoader";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { PhoneInput } from "@/components/ui/phone-input";
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
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { useSubscriptionValidation } from "@/hooks/useSubscriptionValidation";
import { SubscriptionLimitModal } from "@/components/subscription/SubscriptionLimitModal";
import { SubscriptionExpiredModal } from "@/components/subscription/SubscriptionExpiredModal";
import {
  FieldError,
  RequiredLabel,
} from "@/components/forms/form-field-feedback";

type GymOption = {
  id: string;
  name: string;
  owner_id: string;
  owner?: { first_name?: string; last_name?: string; email?: string | null };
};

type LocationFormValues = {
  gym_id: string;
  name: string;
  phone_number: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
};

type LocationData = LocationFormValues & { id: string };

type LimitInfo = {
  current?: number;
  max?: number;
  resourceType?: string;
  locationId?: string;
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

const ManageLocationContent = () => {
  const { data: session, status } = useSession({ required: true });
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const action =
    (searchParams?.get("action") as "create" | "edit" | "view") || "create";
  const locationId = searchParams?.get("id") || null;

  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [limitInfo, setLimitInfo] = useState<LimitInfo | null>(null);
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  const isSuperAdmin =
    status === "authenticated" && session?.user?.role === "SUPER_ADMIN";
  const isGymOwner =
    status === "authenticated" && session?.user?.role === "GYM_OWNER";
  const isAuthorized = isSuperAdmin || isGymOwner;

  const {
    isSubscriptionActive,
    subscriptionExpired,
    currentLocations,
    locationLimit,
    isAtLocationLimit,
    isNearLocationLimit,
    isLocationUsageLoading,
    checkLimitBeforeAction,
  } = useSubscriptionValidation({ includeLocationUsage: true });

  const { data: locationData, isLoading: fetchingLocation } =
    useQuery<LocationData | null>({
      queryKey: ["location", locationId],
      queryFn: async () => {
        if (!locationId) return null;
        const res = await axios.post("/api/locations/getlocation", {
          id: locationId,
        });
        return res.data;
      },
      enabled: isAuthorized && !!locationId && action !== "create",
    });

  // Gym dropdown - filter by owner for GYM_OWNER
  const { data: gymsData, isLoading: gymsLoading } = useQuery({
    queryKey: ["gymsDropdown"],
    queryFn: async () => {
      const res = await axios.post("/api/gyms/getgyms", {});
      return res.data as { data: GymOption[] };
    },
    enabled: isAuthorized,
  });

  // Filter gyms for GYM_OWNER (only show their gyms)
  const gyms = useMemo(() => {
    const allGyms = gymsData?.data ?? [];
    if (isGymOwner) {
      return allGyms.filter((gym) => gym.owner_id === session?.user?.id);
    }
    return allGyms;
  }, [gymsData, isGymOwner, session?.user?.id]);

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
          (owner?.email ? ` (${owner.email})` : ""),
      );
    });
    return map;
  }, [gyms]);

  const createMutation = useMutation({
    mutationFn: (values: LocationFormValues) =>
      axios.post("/api/locations/createlocation", values),
    onSuccess: () => {
      toast.success("Location created successfully");
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      router.push("/locations");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: LocationFormValues) =>
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
      // Check subscription for GYM_OWNER
      if (isGymOwner) {
        if (!isSubscriptionActive || subscriptionExpired) {
          setShowExpiredModal(true);
          return;
        }

        // Check limit before creating
        if (action === "create") {
          const limitCheck = await checkLimitBeforeAction("location");

          if (limitCheck.exceeded) {
            setLimitInfo(limitCheck.limitInfo ?? null);
            setLimitModalOpen(true);
            return;
          }
        }
      }

      try {
        if (action === "create") {
          await createMutation.mutateAsync(values);
        } else if (action === "edit") {
          await updateMutation.mutateAsync(values);
        }
      } catch (error: unknown) {
        // Handle limit exceeded error from API
        const responseData = axios.isAxiosError<LimitInfo & { error?: string }>(
          error,
        )
          ? error.response?.data
          : undefined;

        if (responseData?.error === "LIMIT_EXCEEDED") {
          setLimitInfo(responseData);
          setLimitModalOpen(true);
        } else if (responseData?.error === "SUBSCRIPTION_EXPIRED") {
          setShowExpiredModal(true);
        }
      }
    },
  });

  if (status === "loading") return <FullScreenLoader />;
  if (!isAuthorized) return redirect("/unauthorized");
  if (fetchingLocation) return <FullScreenLoader label="Loading location..." />;

  const isSaving =
    formik.isSubmitting || createMutation.isPending || updateMutation.isPending;
  const isCreateAtCap = isGymOwner && action === "create" && isAtLocationLimit;
  const showPlanBanner =
    isGymOwner &&
    action === "create" &&
    (isAtLocationLimit || isNearLocationLimit);
  const fieldError = (field: keyof LocationFormValues) =>
    formik.touched[field] && formik.errors[field]
      ? String(formik.errors[field])
      : undefined;

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-3xl pb-8">
        <Link
          href="/locations"
          className="mb-6 inline-flex items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ArrowLeft className="size-4" />
          Locations
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            {action === "create"
              ? "Create location"
              : action === "edit"
                ? "Update location"
                : "Location details"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {action === "create"
              ? "Add a location and its contact details to a gym."
              : action === "edit"
                ? "Keep this location's gym, contact, and address details up to date."
                : "Review this location's gym, contact, and address details."}
          </p>
        </div>

        {showPlanBanner && (
          <div
            role={isAtLocationLimit ? "alert" : "status"}
            className="mb-6 flex gap-3 rounded-lg border border-primary-dim/40 bg-status-active p-4"
          >
            <AlertCircle
              className="mt-0.5 size-5 shrink-0 text-status-active-foreground"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isAtLocationLimit
                  ? "Plan limit reached"
                  : "Approaching your plan limit"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                You&apos;re using {currentLocations} of {locationLimit}{" "}
                locations included on your current plan.
              </p>
            </div>
          </div>
        )}

        <form
          className="rounded-lg border border-border bg-card p-5 text-card-foreground sm:p-7"
          onSubmit={formik.handleSubmit}
          noValidate
          aria-busy={isSaving}
        >
          <section aria-labelledby="basic-details-heading">
            <h2
              id="basic-details-heading"
              className="mb-5 text-[13px] font-semibold text-foreground"
            >
              Basic details
            </h2>
            <div className="grid grid-cols-1 gap-5 min-[560px]:grid-cols-2">
              <div className="space-y-2 min-[560px]:col-span-2">
                <RequiredLabel htmlFor="gym_id">Gym</RequiredLabel>
                <Select
                  value={formik.values.gym_id || ""}
                  onValueChange={(value) => {
                    formik.setFieldValue("gym_id", value);
                    formik.setFieldTouched("gym_id", true, false);
                  }}
                  disabled={
                    action === "view" ||
                    gymsLoading ||
                    (isGymOwner && action === "edit")
                  }
                >
                  <SelectTrigger
                    id="gym_id"
                    aria-required="true"
                    aria-invalid={Boolean(fieldError("gym_id"))}
                    aria-describedby={
                      fieldError("gym_id") ? "gym_id-error" : undefined
                    }
                    className="h-10 w-full border-border bg-background shadow-none"
                  >
                    <SelectValue
                      placeholder={gymsLoading ? "Loading…" : "Select gym"}
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
                <FieldError id="gym_id-error" message={fieldError("gym_id")} />
              </div>

              <div className="space-y-2 min-[560px]:col-span-2">
                <RequiredLabel htmlFor="name">Location name</RequiredLabel>
                <Input
                  id="name"
                  name="name"
                  value={formik.values.name}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={action === "view"}
                  placeholder="Enter location name"
                  aria-required="true"
                  aria-invalid={Boolean(fieldError("name"))}
                  aria-describedby={
                    fieldError("name") ? "name-error" : undefined
                  }
                  className="h-10 border-border bg-background shadow-none"
                />
                <FieldError id="name-error" message={fieldError("name")} />
              </div>

              <div className="space-y-2 min-[560px]:col-span-2">
                <Label htmlFor="phone_number">Phone</Label>
                <PhoneInput
                  id="phone_number"
                  name="phone_number"
                  value={formik.values.phone_number}
                  onChange={(value) =>
                    formik.setFieldValue("phone_number", value)
                  }
                  onBlur={() =>
                    formik.setFieldTouched("phone_number", true, true)
                  }
                  disabled={action === "view"}
                  placeholder="Phone number (optional)"
                  defaultCountry="PK"
                  international
                  aria-invalid={Boolean(fieldError("phone_number"))}
                  aria-describedby={
                    fieldError("phone_number")
                      ? "phone_number-error"
                      : undefined
                  }
                />
                <FieldError
                  id="phone_number-error"
                  message={fieldError("phone_number")}
                />
              </div>
            </div>
          </section>

          <section
            aria-labelledby="address-heading"
            className="mt-8 border-t border-border pt-6"
          >
            <h2
              id="address-heading"
              className="mb-5 text-[13px] font-semibold text-foreground"
            >
              Address
            </h2>
            <div className="grid grid-cols-1 gap-5 min-[560px]:grid-cols-2">
              <div className="space-y-2 min-[560px]:col-span-2">
                <Label htmlFor="country">Country</Label>
                <CountryDropdown
                  id="country"
                  name="country"
                  placeholder="Select country"
                  defaultValue={formik.values.country}
                  disabled={action === "view"}
                  onChange={(country) => {
                    formik.setFieldValue("country", country.alpha3);
                    formik.setFieldTouched("country", true, false);
                  }}
                  onBlur={() => formik.setFieldTouched("country", true, true)}
                  aria-invalid={Boolean(fieldError("country"))}
                  aria-describedby={
                    fieldError("country") ? "country-error" : undefined
                  }
                  className="h-10 border-border bg-background shadow-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
                <FieldError
                  id="country-error"
                  message={fieldError("country")}
                />
              </div>

              <div className="space-y-2 min-[560px]:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  name="address"
                  value={formik.values.address}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={action === "view"}
                  placeholder="Address (optional)"
                  aria-invalid={Boolean(fieldError("address"))}
                  aria-describedby={
                    fieldError("address") ? "address-error" : undefined
                  }
                  className="h-10 border-border bg-background shadow-none"
                />
                <FieldError
                  id="address-error"
                  message={fieldError("address")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  value={formik.values.city}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={action === "view"}
                  placeholder="City (optional)"
                  aria-invalid={Boolean(fieldError("city"))}
                  aria-describedby={
                    fieldError("city") ? "city-error" : undefined
                  }
                  className="h-10 border-border bg-background shadow-none"
                />
                <FieldError id="city-error" message={fieldError("city")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  name="state"
                  value={formik.values.state}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={action === "view"}
                  placeholder="State (optional)"
                  aria-invalid={Boolean(fieldError("state"))}
                  aria-describedby={
                    fieldError("state") ? "state-error" : undefined
                  }
                  className="h-10 border-border bg-background shadow-none"
                />
                <FieldError id="state-error" message={fieldError("state")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zip_code">Zip code</Label>
                <Input
                  id="zip_code"
                  name="zip_code"
                  value={formik.values.zip_code}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={action === "view"}
                  placeholder="Zip code (optional)"
                  aria-invalid={Boolean(fieldError("zip_code"))}
                  aria-describedby={
                    fieldError("zip_code") ? "zip_code-error" : undefined
                  }
                  className="h-10 border-border bg-background shadow-none"
                />
                <FieldError
                  id="zip_code-error"
                  message={fieldError("zip_code")}
                />
              </div>
            </div>
          </section>

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
            {action !== "view" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/locations")}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isSaving ||
                    (isGymOwner &&
                      action === "create" &&
                      isLocationUsageLoading) ||
                    (isGymOwner &&
                      (!isSubscriptionActive || subscriptionExpired)) ||
                    isCreateAtCap
                  }
                >
                  {isSaving && (
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  )}
                  {isSaving
                    ? "Saving…"
                    : action === "create"
                      ? "Create location"
                      : "Update location"}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/locations")}
              >
                Back to locations
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
          planName={
            session?.user?.subscription_limits ? "Current Plan" : undefined
          }
        />
      )}
      <SubscriptionExpiredModal
        open={showExpiredModal}
        onClose={() => setShowExpiredModal(false)}
      />
    </PageContainer>
  );
};

const ManageLocationPage = () => {
  return (
    <Suspense fallback={<FullScreenLoader label="Loading..." />}>
      <ManageLocationContent />
    </Suspense>
  );
};

export default ManageLocationPage;
