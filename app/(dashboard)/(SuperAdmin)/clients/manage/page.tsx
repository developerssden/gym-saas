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
import { useState } from "react";
import { PhoneInput } from "@/components/ui/phone-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate, toDate } from "@/lib/date-helper-functions";
import { ChevronDownIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { SubscriptionType, useSubscriptions } from "@/hooks/use-subscription";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ClientSchema = Yup.object({
    first_name: Yup.string().required("First name is required"),
    last_name: Yup.string().required("Last name is required"),
    phone_number: Yup.string(),
    is_active: Yup.boolean()
});

const ManageSubscriptions = () => {
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

    const { data, isLoading } = useSubscriptions({ enabled: true });

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
            last_name: clientData?.monthly_price || "",
            email: clientData?.max_gyms || "",
            phone_number: clientData?.yearly_price || "",
            date_of_birth: clientData?.max_equipment || "",
            address: clientData?.max_members || "",
            city: clientData?.max_equipment || "",
            state: clientData?.max_equipment || "",
            country: clientData?.max_equipment || "",
            subscriptionId: clientData?.subscriptionId,
            subscriptionType: clientData?.SubscriptionType,
            is_active: clientData?.is_active || true,
        },

        validationSchema: ClientSchema,
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
        }
    });

    if (fetching) return <FullScreenLoader label="Loading client..." />;

    return (
        <PageContainer>
            {loading && <FullScreenLoader label="Saving client..." />}
            <div className="w-full space-y-12">
                <h1 className="h1 text-center">
                    {action === "create"
                        ? "Create Subscription"
                        : action === "edit"
                            ? "Edit Subscription"
                            : "View Subscription"}
                </h1>
                <form className="max-w-2xl mx-auto" onSubmit={formik.handleSubmit}>
                    <div className=" grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                        <div className="space-y-1">
                            <Label>First name</Label>
                            <Input
                                name="first_name"
                                value={formik.values.first_name}
                                onChange={formik.handleChange}
                                disabled={action === "view"}
                            />
                            {formik.errors.first_name === "string" && (
                                <p className="text-red-500 text-sm">{formik.errors.first_name}</p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <Label>Last name</Label>
                            <Input
                                name="last_name"
                                value={formik.values.last_name}
                                onChange={formik.handleChange}
                                disabled={action === "view"}
                            />
                            {formik.errors.last_name === "string" && (
                                <p className="text-red-500 text-sm">{formik.errors.last_name}</p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <Label>email</Label>
                            <Input
                                name="email"
                                value={formik.values.email}
                                onChange={formik.handleChange}
                                disabled={action === "view"}
                            />
                            {formik.errors.email === "string" && (
                                <p className="text-red-500 text-sm">{formik.errors.email}</p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <Label>Phone Number</Label>

                            <PhoneInput
                                value={formik.values.phone_number}
                                onChange={(value) =>
                                    formik.setFieldValue("phone_number", value)
                                }
                                defaultCountry="PK"
                                disabled={action === "view"}
                                international
                            />

                            {formik.touched.phone_number &&
                                typeof formik.errors.phone_number === "string" && (
                                    <p className="text-red-500 text-sm">
                                        {formik.errors.phone_number}
                                    </p>
                                )}

                        </div>


                        <div className="flex flex-col gap-3">
                            <Label htmlFor="date_of_birth" className="px-1">
                                Date of birth
                            </Label>

                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        id="date_of_birth"
                                        className="w-full justify-between font-normal"
                                        disabled={action === "view"}
                                    >
                                        {formatDate(formik.values.date_of_birth)}
                                        <ChevronDownIcon />
                                    </Button>
                                </PopoverTrigger>

                                <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={toDate(formik.values.date_of_birth)}
                                        captionLayout="dropdown"
                                        onSelect={(date) => {
                                            if (!date) return;
                                            formik.setFieldValue(
                                                "date_of_birth",
                                                date.toISOString().split("T")[0]
                                            );
                                        }}
                                        disabled={action === "view"}
                                    />
                                </PopoverContent>
                            </Popover>

                            {formik.touched.date_of_birth &&
                                typeof formik.errors.date_of_birth === "string" && (
                                    <p className="text-red-500 text-sm">
                                        {formik.errors.date_of_birth}
                                    </p>
                                )}
                        </div>
                        {/* Max Members */}
                        <div className="space-y-1">
                            <Label>Address</Label>
                            <Input
                                name="address"
                                value={formik.values.address}
                                onChange={formik.handleChange}
                                disabled={action === "view"}
                            />
                            {formik.errors.address === "string" && (
                                <p className="text-red-500 text-sm">{formik.errors.address}</p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <Label>City</Label>
                            <Input
                                name="city"
                                value={formik.values.city}
                                onChange={formik.handleChange}
                                disabled={action === "view"}
                            />
                            {formik.errors.city === "string" && (
                                <p className="text-red-500 text-sm">{formik.errors.city}</p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <Label>State</Label>
                            <Input
                                name="state"
                                value={formik.values.city}
                                onChange={formik.handleChange}
                                disabled={action === "view"}
                            />
                            {formik.errors.state === "string" && (
                                <p className="text-red-500 text-sm">{formik.errors.state}</p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <Label>Country</Label>

                            <CountryDropdown
                                defaultValue={formik.values.country}
                                disabled={action === "view"}
                                onChange={(country) => {
                                    // Store alpha3 code in formik
                                    formik.setFieldValue("country", country.alpha3);
                                }}
                            />

                            {formik.touched.country &&
                                typeof formik.errors.country === "string" && (
                                    <p className="text-red-500 text-sm">
                                        {formik.errors.country}
                                    </p>
                                )}
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="subscriptionId">Subscription</Label>

                            <Select
                                name="subscriptionId"
                                value={formik.values.subscriptionId || ""}
                                onValueChange={(val) => formik.setFieldValue("subscriptionId", val)}
                                disabled={isLoading}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={isLoading ? "Loading..." : "Select subscription"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {data?.data.map((sub: SubscriptionType) => (
                                        <SelectItem key={sub.id} value={sub.id}>
                                            {sub.name} (${sub.monthly_price}/{sub.yearly_price})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {formik.touched.subscriptionId &&
                                typeof formik.errors.subscriptionId === "string" && (
                                    <p className="text-red-500 text-sm">
                                        {formik.errors.subscriptionId}
                                    </p>
                                )}
                        </div>
                        <div className="space-y-1">
  <Label htmlFor="subscriptionType">Subscription Type</Label>

  <Select
    name="subscriptionType"
    value={formik.values.subscriptionType || ""}
    onValueChange={(val) => formik.setFieldValue("subscriptionType", val)}
  >
    <SelectTrigger>
      <SelectValue placeholder="Select subscription type" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="MONTHLY">Monthly</SelectItem>
      <SelectItem value="YEARLY">Yearly</SelectItem>
    </SelectContent>
  </Select>

  {formik.touched.subscriptionType && formik.errors.subscriptionType && typeof formik.errors.subscriptionType === "string" && (
    <p className="text-red-500 text-sm">{formik.errors.subscriptionType}</p>
  )}
</div>


                    </div>

                    {action !== "view" && (
                        <Button type="submit" className="w-full mt-4">
                            {action === "create" ? "Create Subscription" : "Update Subscription"}
                        </Button>
                    )}
                </form>

            </div>
        </PageContainer>
    );
};

export default ManageSubscriptions;
