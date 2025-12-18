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
import { useState } from "react";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDate, toDate } from "@/lib/date-helper-functions";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PlanType, usePlans } from "@/hooks/use-plans";

const ClientSchema = Yup.object({
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
  password: Yup.string()
    .min(6, "Password must be at least 6 characters")
    .when("action", {
      is: "create",
      then: (schema) => schema.required("Password is required"),
      otherwise: (schema) => schema.notRequired(),
    }),
  planId: Yup.string(),
  billingModel: Yup.string().oneOf(["MONTHLY", "YEARLY"]),
});

const ManageClient = () => {
  const searchParams = useSearchParams();
  const action = searchParams?.get("action") as "create" | "edit" | "view";
  const clientId = searchParams?.get("id") || null;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const { data: clientData, isLoading: fetching } = useQuery({
    queryKey: ["clients", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const res = await axios.post(`/api/clients/getclient`, {
        id: clientId,
      });
      return res.data;
    },
    enabled: !!clientId && action !== "create", // only fetch if editing or viewing
  });

  const { data: plansData, isLoading: plansLoading } = usePlans({ enabled: true });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (values) => axios.post("/api/clients/createclient", values),
    onSuccess: (res) => {
      toast.success(res.data.message || "Client created successfully!");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      router.push("/clients");
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: any) =>
      axios.post(`/api/clients/updateclient`, { id: clientId, ...values }),
    onSuccess: (res) => {
      toast.success(res.data.message || "Client updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      router.push("/clients");
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err));
    },
  });

  const formik = useFormik({
    initialValues: {
      first_name: clientData?.first_name || "",
      last_name: clientData?.last_name || "",
      email: clientData?.email || "",
      phone_number: clientData?.phone_number || "",
      date_of_birth: clientData?.date_of_birth 
        ? new Date(clientData.date_of_birth) 
        : undefined,
      address: clientData?.address || "",
      city: clientData?.city || "",
      state: clientData?.state || "",
      country: clientData?.country || "",
      zip_code: clientData?.zip_code || "",
      cnic: clientData?.cnic || "",
      password: "",
      planId: clientData?.activeSubscription?.plan?.id || "",
      billingModel: clientData?.activeSubscription?.billing_model || clientData?.subscriptionType || "",
    },

    validationSchema: ClientSchema,
    enableReinitialize: true,

    onSubmit: async (values) => {
      setLoading(true);
      try {
        // Only include password if it's provided (for updates)
        const submitValues: any = { ...values };
        if (action === "edit" && !submitValues.password) {
          submitValues.password = undefined;
        }
        
        if (action === "create") {
          await createMutation.mutateAsync(submitValues);
        } else if (action === "edit") {
          await updateMutation.mutateAsync(submitValues);
        }
      } finally {
        setLoading(false);
      }
    },
  });

  if (fetching) return <FullScreenLoader label="Loading client..." />;

  return (
    <PageContainer>
      {loading && <FullScreenLoader label="Saving client..." />}
      <div className="w-full space-y-12">
        <h1 className="h1 text-center">
          {action === "create"
            ? "Create Client"
            : action === "edit"
            ? "Edit Client"
            : "View Client"}
        </h1>
        <form className="max-w-2xl mx-auto" onSubmit={formik.handleSubmit}>
          <div className=" grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            <div className="space-y-2">
              <Label>First name</Label>
              <Input
                name="first_name"
                placeholder="Enter first name"
                value={formik.values.first_name}
                onChange={formik.handleChange}
                disabled={action === "view"}
              />
              {formik.touched.first_name && formik.errors.first_name && (
                <p className="text-red-500 text-sm">
                  {String(formik.errors.first_name)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Last name</Label>
              <Input
                name="last_name"
                placeholder="Enter last name"
                value={formik.values.last_name}
                onChange={formik.handleChange}
                disabled={action === "view"}
              />
              {formik.touched.last_name && formik.errors.last_name && (
                <p className="text-red-500 text-sm">
                  {String(formik.errors.last_name)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                name="email"
                type="email"
                placeholder="Enter email"
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={action === "view"}
              />
              {formik.touched.email && formik.errors.email && (
                <p className="text-red-500 text-sm">{String(formik.errors.email)}</p>
              )}
            </div>

            {action === "create" && (
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  name="password"
                  type="password"
                  placeholder="Enter password"
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                {formik.touched.password && formik.errors.password && (
                  <p className="text-red-500 text-sm">{String(formik.errors.password)}</p>
                )}
              </div>
            )}

            {action === "edit" && (
              <div className="space-y-2">
                <Label>New Password (leave blank to keep current)</Label>
                <Input
                  name="password"
                  type="password"
                  placeholder="Enter new password"
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                {formik.touched.password && formik.errors.password && (
                  <p className="text-red-500 text-sm">{String(formik.errors.password)}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Phone Number</Label>

              <PhoneInput
                placeholder="Enter phone number"
                value={formik.values.phone_number}
                onChange={(value) =>
                  formik.setFieldValue("phone_number", value)
                }
                defaultCountry="PK"
                disabled={action === "view"}
                international
              />

              {formik.touched.phone_number && formik.errors.phone_number && (
                <p className="text-red-500 text-sm">
                  {String(formik.errors.phone_number)}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <Label htmlFor="date_of_birth" className="px-1">
                Date of birth
              </Label>

              <Popover>
                <PopoverTrigger className="w-full" asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formik.values.date_of_birth && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formik.values.date_of_birth ? (
                      formatDate(formik.values.date_of_birth)
                    ) : (
                      <span>Pick your date of birth</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Calendar
                  className="w-full"
                    mode="single"
                    selected={formik.values.date_of_birth}
                    onSelect={(date) =>
                      formik.setFieldValue("date_of_birth", date)
                    }
                    autoFocus
                  />
                </PopoverContent>
              </Popover>

              {formik.touched.date_of_birth && formik.errors.date_of_birth && (
                <p className="text-red-500 text-sm">
                  {String(formik.errors.date_of_birth)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>CNIC (Optional)</Label>
              <Input
                name="cnic"
                placeholder="Enter CNIC"
                value={formik.values.cnic}
                onChange={formik.handleChange}
                disabled={action === "view"}
              />
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                name="address"
                placeholder="Enter address"
                value={formik.values.address}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={action === "view"}
              />
              {formik.touched.address && formik.errors.address && (
                <p className="text-red-500 text-sm">{String(formik.errors.address)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>City</Label>
              <Input
                name="city"
                placeholder="Enter city"
                value={formik.values.city}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={action === "view"}
              />
              {formik.touched.city && formik.errors.city && (
                <p className="text-red-500 text-sm">{String(formik.errors.city)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>State</Label>
              <Input
                name="state"
                placeholder="Enter state"
                value={formik.values.state}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={action === "view"}
              />
              {formik.touched.state && formik.errors.state && (
                <p className="text-red-500 text-sm">{String(formik.errors.state)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Zip Code</Label>
              <Input
                name="zip_code"
                placeholder="Enter zip code"
                value={formik.values.zip_code}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={action === "view"}
              />
              {formik.touched.zip_code && formik.errors.zip_code && (
                <p className="text-red-500 text-sm">{String(formik.errors.zip_code)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Country</Label>

              <CountryDropdown
                placeholder="Select country"
                defaultValue={formik.values.country}
                disabled={action === "view"}
                onChange={(country) => {
                  // Store alpha3 code in formik
                  formik.setFieldValue("country", country.alpha3);
                }}
              />

              {formik.touched.country && formik.errors.country && (
                <p className="text-red-500 text-sm">
                  {String(formik.errors.country)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="planId">Plan</Label>

              <Select
                name="planId"
                value={formik.values.planId || ""}
                onValueChange={(val) =>
                  formik.setFieldValue("planId", val)
                }
                disabled={plansLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      plansLoading ? "Loading..." : "Select plan"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="w-full">
                  {plansData?.data.map((sub: PlanType) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.name} - Monthly: ${sub.monthly_price} / Yearly: ${sub.yearly_price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {formik.touched.planId && formik.errors.planId && (
                <p className="text-red-500 text-sm">
                  {String(formik.errors.planId)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingModel">Billing Model</Label>

              <Select
                name="billingModel"
                value={formik.values.billingModel || ""}
                onValueChange={(val) =>
                  formik.setFieldValue("billingModel", val)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select billing model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                </SelectContent>
              </Select>

              {formik.touched.billingModel && formik.errors.billingModel && (
                <p className="text-red-500 text-sm">
                  {String(formik.errors.billingModel)}
                </p>
              )}
            </div>
          </div>

          {action !== "view" && (
            <div className="flex gap-4 mt-4">
              <Button type="submit" className="flex-1">
                {action === "create"
                  ? "Create Client"
                  : "Update Client"}
              </Button>
              {action === "edit" && formik.values.planId && (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={async () => {
                    setLoading(true);
                    try {
                      await updateMutation.mutateAsync({
                        ...formik.values,
                        isRenewal: true,
                      } as any);
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Renew Subscription
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.push("/clients")}
              >
                Cancel
              </Button>
            </div>
          )}

          {action === "view" && (
            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.push("/clients")}
              >
                Back
              </Button>
            </div>
          )}
        </form>
      </div>
    </PageContainer>
  );
};

export default ManageClient;
