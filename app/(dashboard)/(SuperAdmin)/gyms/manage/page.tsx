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
import { useMemo, useState, Suspense, type ReactNode } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { useSubscriptionValidation } from "@/hooks/useSubscriptionValidation";
import { SubscriptionLimitModal } from "@/components/subscription/SubscriptionLimitModal";
import { SubscriptionExpiredModal } from "@/components/subscription/SubscriptionExpiredModal";

type OwnerOption = { id: string; first_name: string; last_name: string; email?: string | null };

const RequiredLabel = ({ htmlFor, children }: { htmlFor: string; children: ReactNode }) => (
  <Label htmlFor={htmlFor}>
    {children}
    <span className="size-1.5 rounded-full bg-primary-dim" aria-hidden="true" />
    <span className="sr-only"> (required)</span>
  </Label>
);

const FieldError = ({ id, message }: { id: string; message?: string }) =>
  message ? (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;

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

  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [limitInfo, setLimitInfo] = useState<any>(null);
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  const isSuperAdmin = status === "authenticated" && session?.user?.role === "SUPER_ADMIN";
  const isGymOwner = status === "authenticated" && session?.user?.role === "GYM_OWNER";
  const isAuthorized = isSuperAdmin || isGymOwner;

  const {
    isSubscriptionActive,
    subscriptionExpired,
    currentGyms,
    gymLimit,
    isAtGymLimit,
    isNearGymLimit,
    isGymUsageLoading,
    checkLimitBeforeAction,
  } = useSubscriptionValidation();

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
        if (!isSubscriptionActive || subscriptionExpired) {
          setShowExpiredModal(true);
          return;
        }

        // Check limit before creating
        if (action === "create") {
          const limitCheck = await checkLimitBeforeAction("gym");

          if (limitCheck.exceeded) {
            setLimitInfo(limitCheck.limitInfo);
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
      } catch (error: any) {
        // Handle limit exceeded error from API
        if (error?.response?.data?.error === "LIMIT_EXCEEDED") {
          setLimitInfo(error.response.data);
          setLimitModalOpen(true);
        } else if (error?.response?.data?.error === "SUBSCRIPTION_EXPIRED") {
          setShowExpiredModal(true);
        }
      }
    },
  });

  if (status === "loading") return <FullScreenLoader />;
  if (!isAuthorized) return redirect("/unauthorized");
  if (fetchingGym) return <FullScreenLoader label="Loading gym..." />;

  const isSaving =
    formik.isSubmitting || createMutation.isPending || updateMutation.isPending;
  const isCreateAtCap = isGymOwner && action === "create" && isAtGymLimit;
  const showPlanBanner =
    isGymOwner && action === "create" && (isAtGymLimit || isNearGymLimit);
  const fieldError = (field: keyof typeof formik.values) =>
    formik.touched[field] && formik.errors[field]
      ? String(formik.errors[field])
      : undefined;

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-3xl pb-8">
        <Link
          href="/gyms"
          className="mb-6 inline-flex items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ArrowLeft className="size-4" />
          Gyms
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            {action === "create"
              ? "Create gym"
              : action === "edit"
                ? "Update gym"
                : "Gym details"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {action === "create"
              ? "Add a gym and its contact details to your account."
              : action === "edit"
                ? "Keep this gym's ownership, contact, and location details up to date."
                : "Review this gym's ownership, contact, and location details."}
          </p>
        </div>

        {showPlanBanner && (
          <div
            role={isAtGymLimit ? "alert" : "status"}
            className="mb-6 flex gap-3 rounded-lg border border-primary-dim/40 bg-status-active p-4"
          >
            <AlertCircle
              className="mt-0.5 size-5 shrink-0 text-status-active-foreground"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isAtGymLimit ? "Plan limit reached" : "Approaching your plan limit"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                You&apos;re using {currentGyms} of {gymLimit} gyms included on your current plan.
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
          {isSuperAdmin && (
            <div className="mb-8 space-y-2">
              <RequiredLabel htmlFor="owner_id">Owner</RequiredLabel>
              <Select
                value={formik.values.owner_id || ""}
                onValueChange={(value) => {
                  formik.setFieldValue("owner_id", value);
                  formik.setFieldTouched("owner_id", true, false);
                }}
                disabled={action === "view" || ownersLoading}
              >
                <SelectTrigger
                  id="owner_id"
                  aria-required="true"
                  aria-invalid={Boolean(fieldError("owner_id"))}
                  aria-describedby={fieldError("owner_id") ? "owner_id-error" : undefined}
                  className="h-10 w-full border-border bg-background shadow-none"
                >
                  <SelectValue placeholder={ownersLoading ? "Loading…" : "Select owner"} />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {ownerLabelById.get(owner.id) || owner.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError id="owner_id-error" message={fieldError("owner_id")} />
            </div>
          )}

          <section aria-labelledby="basic-details-heading">
            <h2
              id="basic-details-heading"
              className="mb-5 text-[13px] font-semibold text-foreground"
            >
              Basic details
            </h2>
            <div className="grid grid-cols-1 gap-5 min-[560px]:grid-cols-2">
              <div className="space-y-2 min-[560px]:col-span-2">
                <RequiredLabel htmlFor="name">Gym name</RequiredLabel>
                <Input
                  id="name"
                  name="name"
                  value={formik.values.name}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={action === "view"}
                  placeholder="Enter gym name"
                  aria-required="true"
                  aria-invalid={Boolean(fieldError("name"))}
                  aria-describedby={fieldError("name") ? "name-error" : undefined}
                  className="h-10 border-border bg-background shadow-none"
                />
                <FieldError id="name-error" message={fieldError("name")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone_number">Phone</Label>
                <Input
                  id="phone_number"
                  name="phone_number"
                  type="tel"
                  value={formik.values.phone_number}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={action === "view"}
                  placeholder="Phone number (optional)"
                  aria-invalid={Boolean(fieldError("phone_number"))}
                  aria-describedby={fieldError("phone_number") ? "phone_number-error" : undefined}
                  className="h-10 border-border bg-background shadow-none"
                />
                <FieldError id="phone_number-error" message={fieldError("phone_number")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  name="country"
                  value={formik.values.country}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={action === "view"}
                  placeholder="Country (optional)"
                  aria-invalid={Boolean(fieldError("country"))}
                  aria-describedby={fieldError("country") ? "country-error" : undefined}
                  className="h-10 border-border bg-background shadow-none"
                />
                <FieldError id="country-error" message={fieldError("country")} />
              </div>
            </div>
          </section>

          <section
            aria-labelledby="location-heading"
            className="mt-8 border-t border-border pt-6"
          >
            <h2
              id="location-heading"
              className="mb-5 text-[13px] font-semibold text-foreground"
            >
              Location
            </h2>
            <div className="grid grid-cols-1 gap-5 min-[560px]:grid-cols-2">
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
                  aria-describedby={fieldError("address") ? "address-error" : undefined}
                  className="h-10 border-border bg-background shadow-none"
                />
                <FieldError id="address-error" message={fieldError("address")} />
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
                  aria-describedby={fieldError("city") ? "city-error" : undefined}
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
                  aria-describedby={fieldError("state") ? "state-error" : undefined}
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
                  aria-describedby={fieldError("zip_code") ? "zip_code-error" : undefined}
                  className="h-10 border-border bg-background shadow-none"
                />
                <FieldError id="zip_code-error" message={fieldError("zip_code")} />
              </div>
            </div>
          </section>

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
            {action !== "view" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/gyms")}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isSaving ||
                    (isGymOwner && action === "create" && isGymUsageLoading) ||
                    (isGymOwner && (!isSubscriptionActive || subscriptionExpired)) ||
                    isCreateAtCap
                  }
                >
                  {isSaving && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
                  {isSaving
                    ? "Saving…"
                    : action === "create"
                      ? "Create gym"
                      : "Update gym"}
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => router.push("/gyms")}>
                Back to gyms
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
      <SubscriptionExpiredModal
        open={showExpiredModal}
        onClose={() => setShowExpiredModal(false)}
      />
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

