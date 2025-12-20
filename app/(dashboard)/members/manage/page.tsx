/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { PageContainer } from "@/components/layout/page-container";
import { useRouter, useSearchParams } from "next/navigation";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDate } from "@/lib/date-helper-functions";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { cn } from "@/lib/utils";
import { useSubscriptionValidation } from "@/hooks/useSubscriptionValidation";
import { SubscriptionLimitModal } from "@/components/subscription/SubscriptionLimitModal";

const MemberSchema = Yup.object({
  first_name: Yup.string().required("First name is required"),
  last_name: Yup.string().required("Last name is required"),
  email: Yup.string().email("Invalid email").required("Email is required"),
  phone_number: Yup.string().required("Phone number is required"),
  date_of_birth: Yup.date().required("Date of birth is required"),
  address: Yup.string().required("Address is required"),
  city: Yup.string().required("City is required"),
  state: Yup.string().required("State is required"),
  country: Yup.string().required("Country is required"),
  zip_code: Yup.string().required("Zip code is required"),
  cnic: Yup.string().notRequired(),
});

const ManageMemberPage = () => {
  const { data: session, status } = useSession({ required: true });
  const searchParams = useSearchParams();
  const action = searchParams?.get("action") as "create" | "edit" | "view";
  const memberId = searchParams?.get("id") || null;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [limitInfo, setLimitInfo] = useState<any>(null);
  const [dateOfBirthOpen, setDateOfBirthOpen] = useState(false);

  const { isSubscriptionActive, subscriptionExpired, subscriptionLimits } =
    useSubscriptionValidation();

  // Get selected gym and location from session (from header selector) - memoize to prevent re-renders
  const selectedGymId = useMemo(
    () => session?.user?.selected_gym_id || "",
    [session?.user?.selected_gym_id]
  );
  const selectedLocationId = useMemo(
    () => session?.user?.selected_location_id || "",
    [session?.user?.selected_location_id]
  );

  // Fetch member data
  const { data: memberData, isLoading: fetchingMember } = useQuery({
    queryKey: ["member", memberId],
    queryFn: async () => {
      if (!memberId) return null;
      const res = await axios.post("/api/members/getmember", { id: memberId });
      return res.data;
    },
    enabled: !!memberId && action !== "create",
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (values: any) => axios.post("/api/members/createmember", values),
    onSuccess: () => {
      toast.success("Member created successfully");
      queryClient.invalidateQueries({ queryKey: ["members"] });
      router.push("/members");
    },
    onError: (err: any) => {
      if (err?.response?.data?.error === "LIMIT_EXCEEDED") {
        setLimitInfo(err.response.data);
        setLimitModalOpen(true);
      } else if (err?.response?.data?.error === "SUBSCRIPTION_EXPIRED") {
        toast.error("Your subscription is expired. Please renew to continue.");
      } else {
        toast.error(getErrorMessage(err));
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: any) =>
      axios.post("/api/members/updatemember", { id: memberId, ...values }),
    onSuccess: () => {
      toast.success("Member updated successfully");
      queryClient.invalidateQueries({ queryKey: ["members"] });
      router.push("/members");
    },
    onError: (err: any) => {
      if (err?.response?.data?.error === "LIMIT_EXCEEDED") {
        setLimitInfo(err.response.data);
        setLimitModalOpen(true);
      } else if (err?.response?.data?.error === "SUBSCRIPTION_EXPIRED") {
        toast.error("Your subscription is expired. Please renew to continue.");
      } else {
        toast.error(getErrorMessage(err));
      }
    },
  });

  // Determine gym_id and location_id based on action - memoize to prevent re-renders
  const gymId = useMemo(
    () => (action === "create" ? selectedGymId : memberData?.gym_id || ""),
    [action, selectedGymId, memberData?.gym_id]
  );
  const locationId = useMemo(
    () => (action === "create" ? selectedLocationId : memberData?.location_id || ""),
    [action, selectedLocationId, memberData?.location_id]
  );

  // Memoize initial values to prevent unnecessary formik re-initializations
  const initialValues = useMemo(
    () => ({
      first_name: memberData?.user?.first_name || "",
      last_name: memberData?.user?.last_name || "",
      email: memberData?.user?.email || "",
      phone_number: memberData?.user?.phone_number || "",
      date_of_birth: memberData?.user?.date_of_birth
        ? new Date(memberData.user.date_of_birth)
        : new Date(),
      address: memberData?.user?.address || "",
      city: memberData?.user?.city || "",
      state: memberData?.user?.state || "",
      country: memberData?.user?.country || "",
      zip_code: memberData?.user?.zip_code || "",
      cnic: memberData?.user?.cnic || "",
    }),
    [
      memberData?.user?.first_name,
      memberData?.user?.last_name,
      memberData?.user?.email,
      memberData?.user?.phone_number,
      memberData?.user?.date_of_birth,
      memberData?.user?.address,
      memberData?.user?.city,
      memberData?.user?.state,
      memberData?.user?.country,
      memberData?.user?.zip_code,
      memberData?.user?.cnic,
    ]
  );

  const formik = useFormik({
    initialValues,
    validationSchema: MemberSchema,
    enableReinitialize: !!memberData, // Only reinitialize when memberData exists
    onSubmit: async (values) => {
      if (!isSubscriptionActive || subscriptionExpired) {
        toast.error("Your subscription is expired. Please renew to continue.");
        return;
      }

      // Validate gym and location selection for create action
      if (action === "create" && (!selectedGymId || !selectedLocationId)) {
        toast.error("Please select a gym and location from the header selector.");
        return;
      }

      setSaving(true);
      try {
        const submitValues = {
          ...values,
          gym_id: gymId,
          location_id: locationId,
        };
        if (action === "create") {
          await createMutation.mutateAsync(submitValues);
        } else if (action === "edit") {
          await updateMutation.mutateAsync(submitValues);
        }
      } finally {
        setSaving(false);
      }
    },
  });


  // Early returns after all hooks
  if (status === "loading") {
    return <FullScreenLoader />;
  }
  if (session?.user?.role !== "GYM_OWNER") {
    return redirect("/unauthorized");
  }

  if (fetchingMember) return <FullScreenLoader label="Loading member..." />;

  return (
    <PageContainer>
      {saving && <FullScreenLoader label="Saving member..." />}
      <div className="w-full space-y-12">
        <h1 className="h1 text-center">
          {action === "create"
            ? "Create Member"
            : action === "edit"
            ? "Edit Member"
            : "View Member"}
        </h1>

        {action === "create" && (!selectedGymId || !selectedLocationId) && (
          <div className="max-w-2xl mx-auto mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Please select a gym and location from the header selector before creating a member.
            </p>
          </div>
        )}

        <form className="max-w-2xl mx-auto" onSubmit={formik.handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            {(action === "edit" || action === "view") && memberData && (
              <>
                <div className="space-y-2 md:col-span-2">
                  <Label>Gym</Label>
                  <Input
                    value={memberData.gym?.name || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Location</Label>
                  <Input
                    value={memberData.location?.name || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>First Name *</Label>
              <Input
                name="first_name"
                value={formik.values.first_name}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={action === "view"}
                placeholder="First name"
              />
              {formik.touched.first_name && formik.errors.first_name && (
                <p className="text-red-500 text-sm">{String(formik.errors.first_name)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Last Name *</Label>
              <Input
                name="last_name"
                value={formik.values.last_name}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={action === "view"}
                placeholder="Last name"
              />
              {formik.touched.last_name && formik.errors.last_name && (
                <p className="text-red-500 text-sm">{String(formik.errors.last_name)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                name="email"
                type="email"
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={action === "view"}
                placeholder="Email"
              />
              {formik.touched.email && formik.errors.email && (
                <p className="text-red-500 text-sm">{String(formik.errors.email)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <Input
                name="phone_number"
                value={formik.values.phone_number}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={action === "view"}
                placeholder="Phone number"
              />
              {formik.touched.phone_number && formik.errors.phone_number && (
                <p className="text-red-500 text-sm">{String(formik.errors.phone_number)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Date of Birth *</Label>
              <Popover open={dateOfBirthOpen} onOpenChange={setDateOfBirthOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formik.values.date_of_birth && "text-muted-foreground"
                    )}
                    disabled={action === "view"}
                    type="button"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formik.values.date_of_birth
                      ? formatDate(formik.values.date_of_birth)
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formik.values.date_of_birth}
                    onSelect={(date) => {
                      if (date) {
                        formik.setFieldValue("date_of_birth", date);
                        setDateOfBirthOpen(false);
                      }
                    }}
                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {formik.touched.date_of_birth && formik.errors.date_of_birth && (
                <p className="text-red-500 text-sm">{String(formik.errors.date_of_birth)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>CNIC</Label>
              <Input
                name="cnic"
                value={formik.values.cnic}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={action === "view"}
                placeholder="CNIC (optional)"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Address *</Label>
              <Input
                name="address"
                value={formik.values.address}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={action === "view"}
                placeholder="Address"
              />
              {formik.touched.address && formik.errors.address && (
                <p className="text-red-500 text-sm">{String(formik.errors.address)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>City *</Label>
              <Input
                name="city"
                value={formik.values.city}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={action === "view"}
                placeholder="City"
              />
              {formik.touched.city && formik.errors.city && (
                <p className="text-red-500 text-sm">{String(formik.errors.city)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>State *</Label>
              <Input
                name="state"
                value={formik.values.state}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={action === "view"}
                placeholder="State"
              />
              {formik.touched.state && formik.errors.state && (
                <p className="text-red-500 text-sm">{String(formik.errors.state)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Zip Code *</Label>
              <Input
                name="zip_code"
                value={formik.values.zip_code}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={action === "view"}
                placeholder="Zip code"
              />
              {formik.touched.zip_code && formik.errors.zip_code && (
                <p className="text-red-500 text-sm">{String(formik.errors.zip_code)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Country *</Label>
              <CountryDropdown
                placeholder="Select country"
                defaultValue={formik.values.country}
                disabled={action === "view"}
                onChange={(country) => {
                  formik.setFieldValue("country", country.alpha3);
                }}
              />
              {formik.touched.country && formik.errors.country && (
                <p className="text-red-500 text-sm">{String(formik.errors.country)}</p>
              )}
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            {action !== "view" ? (
              <>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={!isSubscriptionActive || subscriptionExpired}
                >
                  {action === "create" ? "Create Member" : "Update Member"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push("/members")}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.push("/members")}
              >
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
        />
      )}
    </PageContainer>
  );
};

export default ManageMemberPage;


