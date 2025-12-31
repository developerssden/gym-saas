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
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useMemo, useState, useCallback, useRef, Suspense } from "react";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-helper-functions";
import { cn } from "@/lib/utils";
import { useSubscriptionValidation } from "@/hooks/useSubscriptionValidation";
import { SubscriptionExpiredModal } from "@/components/subscription/SubscriptionExpiredModal";

const MemberSubscriptionSchema = Yup.object({
  member_id: Yup.string().required("Member is required"),
  price: Yup.number().required("Price is required").min(0, "Price must be positive"),
  use_custom_dates: Yup.boolean(),
  months: Yup.number().when("use_custom_dates", {
    is: false,
    then: (schema) => schema.required("Months is required").min(1, "Must be at least 1 month"),
    otherwise: (schema) => schema.notRequired(),
  }),
  start_date: Yup.date().when("use_custom_dates", {
    is: true,
    then: (schema) => schema.required("Start date is required"),
    otherwise: (schema) => schema.notRequired(),
  }),
  end_date: Yup.date().when("use_custom_dates", {
    is: true,
    then: (schema) => schema.required("End date is required"),
    otherwise: (schema) => schema.notRequired(),
  }),
});

const ManageMemberSubscriptionContent = () => {
  const { data: session, status } = useSession({ required: true });
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const action =
    (searchParams?.get("action") as "create" | "edit" | "view") || "create";
  const subscriptionId = searchParams?.get("id") || null;

  const [saving, setSaving] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  const { isSubscriptionActive, subscriptionExpired } = useSubscriptionValidation();

  // Fetch subscription data
  const { data: subscriptionData, isLoading: fetchingSubscription } = useQuery({
    queryKey: ["memberSubscription", subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) return null;
      const res = await axios.post("/api/membersubscriptions/getmembersubscriptions", {
        member_id: null,
        page: 1,
        limit: 1000,
      });
      const subscription = res.data.data.find((sub: any) => sub.id === subscriptionId);
      return subscription || null;
    },
    enabled: !!subscriptionId && action !== "create",
  });

  // Fetch owner's members
  const { data: membersData } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const res = await axios.post("/api/members/getmembers", {
        page: 1,
        limit: 1000,
      });
      return res.data.data || [];
    },
    enabled: true,
  });

  const members = useMemo(() => membersData || [], [membersData]);

  const memberLabelById = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m: any) => {
      map.set(
        m.id,
        `${m.user.first_name} ${m.user.last_name}`.trim() +
          (m.user.email ? ` (${m.user.email})` : "")
      );
    });
    return map;
  }, [members]);

  // Calculate end date from months if not using custom dates
  const calculateEndDate = (startDate: Date, months: number) => {
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);
    return endDate;
  };

  const createMutation = useMutation({
    mutationFn: (values: any) =>
      axios.post("/api/membersubscriptions/createmembersubscription-owner", values),
    onSuccess: () => {
      toast.success("Member subscription created successfully");
      queryClient.invalidateQueries({ queryKey: ["membersubscriptions"] });
      router.push("/membersubscriptions");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: any) =>
      axios.post("/api/membersubscriptions/updatemembersubscription-owner", {
        id: subscriptionId,
        ...values,
      }),
    onSuccess: () => {
      toast.success("Member subscription updated successfully");
      queryClient.invalidateQueries({ queryKey: ["membersubscriptions"] });
      router.push("/membersubscriptions");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  // Memoize initial values to prevent unnecessary formik re-initializations
  const initialValues = useMemo(
    () => ({
      member_id: subscriptionData?.member_id || "",
      price: subscriptionData?.price || 0,
      use_custom_dates: subscriptionData?.use_custom_dates ?? false,
      months: subscriptionData?.months || 1,
      start_date: subscriptionData?.start_date
        ? new Date(subscriptionData.start_date)
        : new Date(),
      end_date: subscriptionData?.end_date
        ? new Date(subscriptionData.end_date)
        : calculateEndDate(new Date(), subscriptionData?.months || 1),
    }),
    [
      subscriptionData?.member_id,
      subscriptionData?.price,
      subscriptionData?.use_custom_dates,
      subscriptionData?.months,
      subscriptionData?.start_date,
      subscriptionData?.end_date,
    ]
  );

  const formik = useFormik({
    initialValues,
    validationSchema: MemberSubscriptionSchema,
    enableReinitialize: !!subscriptionData,
    onSubmit: async (values) => {
      if (!isSubscriptionActive || subscriptionExpired) {
        setShowExpiredModal(true);
        return;
      }

      setSaving(true);
      try {
        const submitData: any = {
          member_id: values.member_id,
          price: values.price,
          use_custom_dates: values.use_custom_dates,
        };

        if (values.use_custom_dates) {
          submitData.start_date = values.start_date.toISOString();
          submitData.end_date = values.end_date.toISOString();
        } else {
          submitData.months = values.months;
        }

        if (action === "create") {
          await createMutation.mutateAsync(submitData);
        } else if (action === "edit") {
          await updateMutation.mutateAsync(submitData);
        }
      } finally {
        setSaving(false);
      }
    },
  });

  // Use ref to access formik to prevent handler recreation
  const formikRef = useRef(formik);
  formikRef.current = formik;

  // Memoize handler to prevent unnecessary re-renders
  const handleMemberChange = useCallback((val: string) => {
    formikRef.current.setFieldValue("member_id", val, false);
  }, []);


  // Early returns after all hooks
  if (status === "loading") {
    return <FullScreenLoader />;
  }
  if (session?.user?.role !== "GYM_OWNER") {
    return redirect("/unauthorized");
  }

  if (fetchingSubscription) return <FullScreenLoader label="Loading subscription..." />;

  return (
    <PageContainer>
      {saving && <FullScreenLoader label="Saving subscription..." />}
      <div className="w-full space-y-12">
        <h1 className="h1 text-center">
          {action === "create"
            ? "Create Member Subscription"
            : action === "edit"
            ? "Edit Member Subscription"
            : "View Member Subscription"}
        </h1>

        <form className="max-w-2xl mx-auto" onSubmit={formik.handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            <div className="space-y-2 md:col-span-2">
              <Label>Member *</Label>
              <Select
                value={formik.values.member_id || ""}
                onValueChange={handleMemberChange}
                disabled={action === "view"}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      {memberLabelById.get(m.id) || m.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formik.touched.member_id && formik.errors.member_id && (
                <p className="text-red-500 text-sm">{String(formik.errors.member_id)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Price *</Label>
              <Input
                name="price"
                type="number"
                value={formik.values.price}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={action === "view"}
                placeholder="Price"
                min="0"
                step="0.01"
              />
              {formik.touched.price && formik.errors.price && (
                <p className="text-red-500 text-sm">{String(formik.errors.price)}</p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="use_custom_dates"
                  checked={formik.values.use_custom_dates}
                  onCheckedChange={(checked) => {
                    formik.setFieldValue("use_custom_dates", checked, false);
                    if (!checked) {
                      // Reset to months-based calculation
                      const newStartDate = new Date();
                      const newEndDate = calculateEndDate(newStartDate, formik.values.months);
                      formik.setFieldValue("start_date", newStartDate, false);
                      formik.setFieldValue("end_date", newEndDate, false);
                    }
                  }}
                  disabled={action === "view"}
                />
                <Label htmlFor="use_custom_dates">Use Custom Dates</Label>
              </div>
            </div>

            {!formik.values.use_custom_dates ? (
              <div className="space-y-2">
                <Label>Number of Months *</Label>
                <Input
                  name="months"
                  type="number"
                  value={formik.values.months}
                  onChange={(e) => {
                    const months = parseInt(e.target.value) || 1;
                    const newEndDate = calculateEndDate(formik.values.start_date, months);
                    formik.setFieldValue("months", months, false);
                    formik.setFieldValue("end_date", newEndDate, false);
                  }}
                  onBlur={formik.handleBlur}
                  disabled={action === "view"}
                  placeholder="Months"
                  min="1"
                />
                {formik.touched.months && formik.errors.months && (
                  <p className="text-red-500 text-sm">{String(formik.errors.months)}</p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formik.values.start_date && "text-muted-foreground"
                        )}
                        disabled={action === "view"}
                        type="button"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formik.values.start_date
                          ? formatDate(formik.values.start_date)
                          : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formik.values.start_date}
                        onSelect={(date) => {
                          if (date) {
                            formik.setFieldValue("start_date", date, false);
                            // If not using custom dates, update end date
                            if (!formik.values.use_custom_dates) {
                              const newEndDate = calculateEndDate(date, formik.values.months);
                              formik.setFieldValue("end_date", newEndDate, false);
                            }
                            setStartDateOpen(false);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {formik.touched.start_date && formik.errors.start_date && (
                    <p className="text-red-500 text-sm">{String(formik.errors.start_date)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formik.values.end_date && "text-muted-foreground"
                        )}
                        disabled={action === "view"}
                        type="button"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formik.values.end_date
                          ? formatDate(formik.values.end_date)
                          : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formik.values.end_date}
                        onSelect={(date) => {
                          if (date) {
                            formik.setFieldValue("end_date", date);
                            setEndDateOpen(false);
                          }
                        }}
                        disabled={(date) => date <= formik.values.start_date}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {formik.touched.end_date && formik.errors.end_date && (
                    <p className="text-red-500 text-sm">{String(formik.errors.end_date)}</p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex gap-4 mt-6">
            {action !== "view" ? (
              <>
                <Button
                  type="submit"
                  className="flex-1"
                  onClick={(e) => {
                    if (!isSubscriptionActive || subscriptionExpired) {
                      e.preventDefault();
                      setShowExpiredModal(true);
                    }
                  }}
                >
                  {action === "create" ? "Create Subscription" : "Update Subscription"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push("/membersubscriptions")}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.push("/membersubscriptions")}
              >
                Back
              </Button>
            )}
          </div>
        </form>
      </div>
      <SubscriptionExpiredModal
        open={showExpiredModal}
        onClose={() => setShowExpiredModal(false)}
      />
    </PageContainer>
  );
};

const ManageMemberSubscriptionPage = () => {
  return (
    <Suspense fallback={<FullScreenLoader label="Loading..." />}>
      <ManageMemberSubscriptionContent />
    </Suspense>
  );
};

export default ManageMemberSubscriptionPage;

