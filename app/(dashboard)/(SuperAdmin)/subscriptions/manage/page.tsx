/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import FullScreenLoader from "@/components/common/FullScreenLoader";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlans } from "@/hooks/use-plans";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type ClientOption = {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
};

const ManageOwnerSubscriptionPage = () => {
  const { data: session, status } = useSession({ required: true });
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const action =
    (searchParams?.get("action") as "create" | "edit" | "view") || "create";
  const subscriptionId = searchParams?.get("id") || null;

  const [saving, setSaving] = useState(false);

  const isSuperAdmin =
    status === "authenticated" && session?.user?.role === "SUPER_ADMIN";

  const { data: subscriptionData, isLoading: fetchingSubscription } = useQuery({
    queryKey: ["ownerSubscription", subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) return null;
      const res = await axios.post("/api/subscription/getsubscription", {
        id: subscriptionId,
      });
      return res.data;
    },
    enabled: isSuperAdmin && !!subscriptionId && action !== "create",
  });

  const { data: plansData, isLoading: plansLoading } = usePlans({
    enabled: isSuperAdmin,
  });

  // Owners dropdown: reuse clients API (GYM_OWNER users)
  const { data: ownersData, isLoading: ownersLoading } = useQuery({
    queryKey: ["ownersDropdown"],
    queryFn: async () => {
      const res = await axios.post("/api/clients/getclients", {
        page: 1,
        limit: 200,
        search: "",
      });
      return res.data as { data: ClientOption[] };
    },
    enabled: isSuperAdmin,
  });

  const owners = useMemo(() => ownersData?.data ?? [], [ownersData]);

  const ownerLabelById = useMemo(() => {
    const map = new Map<string, string>();
    owners.forEach((o) => {
      map.set(
        o.id,
        `${o.first_name} ${o.last_name}`.trim() +
          (o.email ? ` (${o.email})` : "")
      );
    });
    return map;
  }, [owners]);

  const createMutation = useMutation({
    mutationFn: (values: any) =>
      axios.post("/api/subscription/createsubscription", values),
    onSuccess: () => {
      toast.success("Subscription created successfully");
      queryClient.invalidateQueries({ queryKey: ["ownerSubscriptions"] });
      router.push("/subscriptions");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: any) =>
      axios.post("/api/subscription/updatesubscription", {
        id: subscriptionId,
        ...values,
      }),
    onSuccess: () => {
      toast.success("Subscription updated successfully");
      queryClient.invalidateQueries({ queryKey: ["ownerSubscriptions"] });
      router.push("/subscriptions");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const validationSchema = useMemo(() => {
    const isCreate = action === "create";
    return Yup.object({
      owner_id: Yup.string().required("Owner is required"),
      plan_id: Yup.string().required("Plan is required"),
      billing_model: Yup.string()
        .oneOf(["MONTHLY", "YEARLY"])
        .required("Billing model is required"),
      start_date: Yup.string().notRequired(),
      end_date: Yup.string().notRequired(),
      amount: Yup.number()
        .typeError("Amount must be a number")
        .positive("Amount must be positive")
        .transform((value, originalValue) => {
          // Allow empty string to behave like "not set"
          return originalValue === "" ? undefined : value;
        }),
      payment_method: Yup.string()
        .oneOf(["CASH", "BANK_TRANSFER"])
        .when([], {
          is: () => isCreate,
          then: (schema) => schema.required("Payment method is required"),
          otherwise: (schema) => schema.notRequired(),
        })
        .when("amount", {
          is: (a: unknown) =>
            a !== undefined &&
            a !== null &&
            String(a).trim() !== "" &&
            String(a) !== "NaN",
          then: (schema) =>
            schema.required(
              "Payment method is required when amount is provided"
            ),
          otherwise: (schema) => schema.notRequired(),
        }),
      transaction_id: Yup.string().when("payment_method", {
        is: "BANK_TRANSFER",
        then: (schema) =>
          schema.required("Transaction ID is required for bank transfer"),
        otherwise: (schema) => schema.notRequired(),
      }),
      payment_date: Yup.string().notRequired(),
      notes: Yup.string().notRequired(),
    });
  }, [action]);

  const formik = useFormik({
    initialValues: {
      owner_id: subscriptionData?.owner_id || "",
      plan_id: subscriptionData?.plan_id || "",
      billing_model: subscriptionData?.billing_model || "",
      start_date: subscriptionData?.start_date
        ? new Date(subscriptionData.start_date).toISOString().slice(0, 10)
        : "",
      end_date: subscriptionData?.end_date
        ? new Date(subscriptionData.end_date).toISOString().slice(0, 10)
        : "",
      amount: "",
      payment_method: action === "create" ? "CASH" : "",
      transaction_id: "",
      payment_date: new Date().toISOString().slice(0, 10),
      notes: "",
    },
    validationSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setSaving(true);
      try {
        const payload: any = {
          owner_id: values.owner_id,
          plan_id: values.plan_id,
          billing_model: values.billing_model,
        };
        if (values.start_date) {
          // send ISO string so API can parse reliably
          payload.start_date = new Date(values.start_date).toISOString();
        }
        if (values.end_date) {
          payload.end_date = new Date(values.end_date).toISOString();
        }

        // Payments:
        // - On create: payment_method is required by API; UI enforces by requiring user to pick.
        // - On edit: allow adding a payment optionally.
        const hasPayment =
          (values.payment_method && values.payment_method !== "") ||
          (values.amount !== "" &&
            values.amount !== null &&
            values.amount !== undefined);

        if (action === "create" || hasPayment) {
          payload.payment_method = values.payment_method;
          payload.amount = values.amount;
          if (values.transaction_id)
            payload.transaction_id = values.transaction_id;
          if (values.payment_date)
            payload.payment_date = new Date(values.payment_date).toISOString();
          if (values.notes) payload.notes = values.notes;
        }

        if (action === "create") {
          await createMutation.mutateAsync(payload);
        } else if (action === "edit") {
          await updateMutation.mutateAsync(payload);
        }
      } finally {
        setSaving(false);
      }
    },
  });

  if (status === "loading") return <FullScreenLoader />;
  if (!isSuperAdmin) return redirect("/unauthorized");
  if (fetchingSubscription)
    return <FullScreenLoader label="Loading subscription..." />;

  return (
    <PageContainer>
      {saving && <FullScreenLoader label="Saving subscription..." />}
      <div className="w-full space-y-12">
        <h1 className="h1 text-center">
          {action === "create"
            ? "Create Subscription"
            : action === "edit"
            ? "Edit Subscription"
            : "View Subscription"}
        </h1>

        <form className="max-w-2xl mx-auto" onSubmit={formik.handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            <div className="space-y-2">
              <Label>Owner</Label>
              <Select
                value={formik.values.owner_id || ""}
                onValueChange={(val) => formik.setFieldValue("owner_id", val)}
                disabled={action === "view" || ownersLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={ownersLoading ? "Loading..." : "Select owner"}
                  />
                </SelectTrigger>
                <SelectContent className="w-full">
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {ownerLabelById.get(o.id) || o.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formik.touched.owner_id && formik.errors.owner_id && (
                <p className="text-red-500 text-sm">
                  {String(formik.errors.owner_id)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Plan</Label>
              <Select
                value={formik.values.plan_id || ""}
                onValueChange={(val) => formik.setFieldValue("plan_id", val)}
                disabled={action === "view" || plansLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={plansLoading ? "Loading..." : "Select plan"}
                  />
                </SelectTrigger>
                <SelectContent className="w-full">
                  {plansData?.data.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — Monthly: ${p.monthly_price} / Yearly: $
                      {p.yearly_price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formik.touched.plan_id && formik.errors.plan_id && (
                <p className="text-red-500 text-sm">
                  {String(formik.errors.plan_id)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Billing Model</Label>
              <Select
                value={formik.values.billing_model || ""}
                onValueChange={(val) =>
                  formik.setFieldValue("billing_model", val)
                }
                disabled={action === "view"}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select billing model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                </SelectContent>
              </Select>
              {formik.touched.billing_model && formik.errors.billing_model && (
                <p className="text-red-500 text-sm">
                  {String(formik.errors.billing_model)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Start Date (optional)</Label>
              <Input
                type="date"
                name="start_date"
                value={formik.values.start_date}
                onChange={formik.handleChange}
                disabled={action === "view"}
              />
              {formik.touched.start_date && formik.errors.start_date && (
                <p className="text-red-500 text-sm">
                  {String(formik.errors.start_date)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>End Date (optional)</Label>
              <Input
                type="date"
                name="end_date"
                value={formik.values.end_date}
                onChange={formik.handleChange}
                disabled={action === "view"}
              />
              {formik.touched.end_date && formik.errors.end_date && (
                <p className="text-red-500 text-sm">
                  {String(formik.errors.end_date)}
                </p>
              )}
            </div>
          </div>

          {/* Payment section */}
          <div className="mt-8 space-y-4">
            <h2 className="text-lg font-semibold">Payment</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
              <div className="space-y-2">
                <Label>Amount {action === "create" ? "*" : "(optional)"}</Label>
                <Input
                  type="number"
                  name="amount"
                  value={formik.values.amount}
                  onChange={formik.handleChange}
                  disabled={action === "view"}
                  placeholder="Enter amount"
                />
                {formik.touched.amount && formik.errors.amount && (
                  <p className="text-red-500 text-sm">
                    {String(formik.errors.amount)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  Payment Method {action === "create" ? "*" : "(optional)"}
                </Label>
                <Select
                  value={formik.values.payment_method || ""}
                  onValueChange={(val) =>
                    formik.setFieldValue("payment_method", val)
                  }
                  disabled={action === "view"}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
                {formik.touched.payment_method &&
                  formik.errors.payment_method && (
                    <p className="text-red-500 text-sm">
                      {String(formik.errors.payment_method)}
                    </p>
                  )}
              </div>

              <div className="space-y-2">
                <Label>Transaction ID</Label>
                <Input
                  type="text"
                  name="transaction_id"
                  value={formik.values.transaction_id}
                  onChange={formik.handleChange}
                  disabled={
                    action === "view" || formik.values.payment_method === "CASH"
                  }
                  placeholder={
                    formik.values.payment_method === "BANK_TRANSFER"
                      ? "Required for bank transfer"
                      : "Auto-generated for cash if empty"
                  }
                />
                {formik.touched.transaction_id &&
                  formik.errors.transaction_id && (
                    <p className="text-red-500 text-sm">
                      {String(formik.errors.transaction_id)}
                    </p>
                  )}
              </div>

              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  name="payment_date"
                  value={formik.values.payment_date}
                  onChange={formik.handleChange}
                  disabled={action === "view"}
                />
                {formik.touched.payment_date && formik.errors.payment_date && (
                  <p className="text-red-500 text-sm">
                    {String(formik.errors.payment_date)}
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  name="notes"
                  value={formik.values.notes}
                  onChange={formik.handleChange}
                  disabled={action === "view"}
                  placeholder="Notes (optional)"
                  rows={3}
                />
                {formik.touched.notes && formik.errors.notes && (
                  <p className="text-red-500 text-sm">
                    {String(formik.errors.notes)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            {action !== "view" ? (
              <>
                <Button type="submit" className="flex-1">
                  {action === "create"
                    ? "Create Subscription"
                    : "Update Subscription"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push("/subscriptions")}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.push("/subscriptions")}
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

export default ManageOwnerSubscriptionPage;
