/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { PageContainer } from "@/components/layout/page-container";
import { useRouter, useSearchParams } from "next/navigation";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import { useState, useMemo, useEffect } from "react";
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
  gym_id: Yup.string().required("Gym is required"),
  location_id: Yup.string().required("Location is required"),
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

  if (status === "loading") {
    return <FullScreenLoader />;
  }
  if (session?.user?.role !== "GYM_OWNER") {
    return redirect("/unauthorized");
  }

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

  // Fetch owner's gyms
  const { data: gymsData } = useQuery({
    queryKey: ["gyms"],
    queryFn: async () => {
      const res = await axios.post("/api/gyms/getgyms", { page: 1, limit: 1000 });
      return res.data.data || [];
    },
    enabled: true,
  });

  const gyms = useMemo(() => gymsData || [], [gymsData]);

  // Fetch locations for selected gym
  const selectedGymId = useFormik({
    initialValues: { gym_id: memberData?.gym_id || "" },
  }).values.gym_id;

  const { data: locationsData } = useQuery({
    queryKey: ["locations", selectedGymId],
    queryFn: async () => {
      if (!selectedGymId) return [];
      const res = await axios.post("/api/locations/getlocations", {
        page: 1,
        limit: 1000,
        gym_id: selectedGymId,
      });
      return res.data.data || [];
    },
    enabled: !!selectedGymId,
  });

  const locations = useMemo(() => locationsData || [], [locationsData]);

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

  const formik = useFormik({
    initialValues: {
      gym_id: memberData?.gym_id || "",
      location_id: memberData?.location_id || "",
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
    },
    validationSchema: MemberSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      if (!isSubscriptionActive || subscriptionExpired) {
        toast.error("Your subscription is expired. Please renew to continue.");
        return;
      }

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

  // Reset location when gym changes
  useEffect(() => {
    if (formik.values.gym_id && formik.values.location_id) {
      const locationBelongsToGym = locations.some(
        (loc: any) => loc.id === formik.values.location_id && loc.gym_id === formik.values.gym_id
      );
      if (!locationBelongsToGym) {
        formik.setFieldValue("location_id", "");
      }
    }
  }, [formik.values.gym_id, locations]);

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

        <form className="max-w-2xl mx-auto" onSubmit={formik.handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            <div className="space-y-2 md:col-span-2">
              <Label>Gym *</Label>
              <Select
                value={formik.values.gym_id}
                onValueChange={(val) => {
                  formik.setFieldValue("gym_id", val);
                  formik.setFieldValue("location_id", ""); // Clear location when gym changes
                }}
                disabled={action === "view"}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select gym" />
                </SelectTrigger>
                <SelectContent>
                  {gyms.map((gym: any) => (
                    <SelectItem key={gym.id} value={gym.id}>
                      {gym.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formik.touched.gym_id && formik.errors.gym_id && (
                <p className="text-red-500 text-sm">{String(formik.errors.gym_id)}</p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Location *</Label>
              <Select
                value={formik.values.location_id}
                onValueChange={(val) => formik.setFieldValue("location_id", val)}
                disabled={action === "view" || !formik.values.gym_id}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      !formik.values.gym_id
                        ? "Select gym first"
                        : locations.length === 0
                        ? "No locations available"
                        : "Select location"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc: any) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formik.touched.location_id && formik.errors.location_id && (
                <p className="text-red-500 text-sm">{String(formik.errors.location_id)}</p>
              )}
            </div>

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

