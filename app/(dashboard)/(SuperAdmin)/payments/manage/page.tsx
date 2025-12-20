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
import { useOwnerSubscriptions } from "@/hooks/use-owner-subscriptions";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useMemo, useState, Suspense } from "react";
import { toast } from "sonner";

const ManagePaymentSchema = Yup.object({
  owner_subscription_id: Yup.string().required("Owner subscription is required"),
  amount: Yup.number().positive("Amount must be positive").required("Amount is required"),
  payment_method: Yup.string().oneOf(["CASH", "BANK_TRANSFER"]).required("Payment method is required"),
  transaction_id: Yup.string().notRequired(),
  payment_date: Yup.string().notRequired(),
  notes: Yup.string().notRequired(),
});

const ManagePaymentContent = () => {
  const { data: session, status } = useSession({ required: true });
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const action = (searchParams?.get("action") as "create" | "edit" | "view") || "create";
  const paymentId = searchParams?.get("id") || null;

  const [saving, setSaving] = useState(false);

  if (status === "loading") return <FullScreenLoader />;
  if (session?.user?.role !== "SUPER_ADMIN") return redirect("/unauthorized");

  const { data: paymentData, isLoading: fetchingPayment } = useQuery({
    queryKey: ["payment", paymentId],
    queryFn: async () => {
      if (!paymentId) return null;
      // Fetch payment by getting all payments and filtering (since there's no getpayment endpoint)
      const res = await axios.post("/api/payments/getpayments", { page: 1, limit: 1000 });
      const payment = res.data.data.find((p: any) => p.id === paymentId);
      return payment || null;
    },
    enabled: !!paymentId && action !== "create",
  });

  // Fetch owner subscriptions for dropdown
  const { data: ownerSubscriptionsData } = useOwnerSubscriptions({
    enabled: true,
  });

  const ownerSubscriptions = ownerSubscriptionsData?.data ?? [];

  const ownerSubscriptionLabelById = useMemo(() => {
    const map = new Map<string, string>();
    ownerSubscriptions.forEach((sub) => {
      const owner = sub.owner;
      const plan = sub.plan;
      const label = owner
        ? `${owner.first_name} ${owner.last_name}`.trim() + (plan ? ` - ${plan.name}` : "")
        : sub.id;
      map.set(sub.id, label);
    });
    return map;
  }, [ownerSubscriptions]);

  const createMutation = useMutation({
    mutationFn: (values: any) => axios.post("/api/payments/createpayment", values),
    onSuccess: () => {
      toast.success("Payment created successfully");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      router.push("/payments");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const formik = useFormik({
    initialValues: {
      owner_subscription_id: paymentData?.owner_subscription_id || "",
      amount: paymentData?.amount || "",
      payment_method: paymentData?.payment_method || "",
      transaction_id: paymentData?.transaction_id || "",
      payment_date: paymentData?.payment_date
        ? new Date(paymentData.payment_date).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      notes: paymentData?.notes || "",
    },
    validationSchema: ManagePaymentSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setSaving(true);
      try {
        const payload: any = {
          subscription_type: "OWNER",
          owner_subscription_id: values.owner_subscription_id,
          amount: values.amount,
          payment_method: values.payment_method,
        };

        if (values.transaction_id) {
          payload.transaction_id = values.transaction_id;
        }

        if (values.payment_date) {
          payload.payment_date = new Date(values.payment_date).toISOString();
        }

        if (values.notes) {
          payload.notes = values.notes;
        }

        if (action === "create") {
          await createMutation.mutateAsync(payload);
        }
        // Note: Edit functionality would require an updatepayment API endpoint
      } finally {
        setSaving(false);
      }
    },
  });

  if (fetchingPayment) return <FullScreenLoader label="Loading payment..." />;

  return (
    <PageContainer>
      {saving && <FullScreenLoader label="Saving payment..." />}
      <div className="w-full space-y-12">
        <h1 className="h1 text-center">
          {action === "create"
            ? "Create Payment"
            : action === "edit"
              ? "Edit Payment"
              : "View Payment"}
        </h1>

        <form className="max-w-2xl mx-auto" onSubmit={formik.handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            <div className="space-y-2 md:col-span-2">
              <Label>Owner Subscription *</Label>
              <Select
                value={formik.values.owner_subscription_id || ""}
                onValueChange={(val) => formik.setFieldValue("owner_subscription_id", val)}
                disabled={action === "view"}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select owner subscription" />
                </SelectTrigger>
                <SelectContent>
                  {ownerSubscriptions.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {ownerSubscriptionLabelById.get(sub.id) || sub.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formik.touched.owner_subscription_id && formik.errors.owner_subscription_id && (
                <p className="text-red-500 text-sm">{String(formik.errors.owner_subscription_id)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                name="amount"
                value={formik.values.amount}
                onChange={formik.handleChange}
                disabled={action === "view"}
                placeholder="Enter amount"
              />
              {formik.touched.amount && formik.errors.amount && (
                <p className="text-red-500 text-sm">{String(formik.errors.amount)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Payment Method *</Label>
              <Select
                value={formik.values.payment_method || ""}
                onValueChange={(val) => formik.setFieldValue("payment_method", val)}
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
              {formik.touched.payment_method && formik.errors.payment_method && (
                <p className="text-red-500 text-sm">{String(formik.errors.payment_method)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Transaction ID</Label>
              <Input
                type="text"
                name="transaction_id"
                value={formik.values.transaction_id}
                onChange={formik.handleChange}
                disabled={action === "view"}
                placeholder="Enter transaction ID (optional)"
              />
              {formik.touched.transaction_id && formik.errors.transaction_id && (
                <p className="text-red-500 text-sm">{String(formik.errors.transaction_id)}</p>
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
                <p className="text-red-500 text-sm">{String(formik.errors.payment_date)}</p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea
                name="notes"
                value={formik.values.notes}
                onChange={formik.handleChange}
                disabled={action === "view"}
                placeholder="Enter notes (optional)"
                rows={3}
              />
              {formik.touched.notes && formik.errors.notes && (
                <p className="text-red-500 text-sm">{String(formik.errors.notes)}</p>
              )}
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            {action !== "view" ? (
              <>
                <Button type="submit" className="flex-1">
                  {action === "create" ? "Create Payment" : "Update Payment"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push("/payments")}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.push("/payments")}
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

const ManagePaymentPage = () => {
  return (
    <Suspense fallback={<FullScreenLoader label="Loading..." />}>
      <ManagePaymentContent />
    </Suspense>
  );
};

export default ManagePaymentPage;

