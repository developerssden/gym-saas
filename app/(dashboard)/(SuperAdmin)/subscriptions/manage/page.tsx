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

type ClientOption = { id: string; first_name: string; last_name: string; email?: string | null };

const ManageOwnerSubscriptionSchema = Yup.object({
  owner_id: Yup.string().required("Owner is required"),
  plan_id: Yup.string().required("Plan is required"),
  billing_model: Yup.string().oneOf(["MONTHLY", "YEARLY"]).required("Billing model is required"),
  start_date: Yup.string().notRequired(),
});

const ManageOwnerSubscriptionPage = () => {
  const { data: session, status } = useSession({ required: true });
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const action = (searchParams?.get("action") as "create" | "edit" | "view") || "create";
  const subscriptionId = searchParams?.get("id") || null;

  const [saving, setSaving] = useState(false);

  if (status === "loading") return <FullScreenLoader />;
  if (session?.user?.role !== "SUPER_ADMIN") return redirect("/unauthorized");

  const { data: subscriptionData, isLoading: fetchingSubscription } = useQuery({
    queryKey: ["ownerSubscription", subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) return null;
      const res = await axios.post("/api/subscription/getsubscription", { id: subscriptionId });
      return res.data;
    },
    enabled: !!subscriptionId && action !== "create",
  });

  const { data: plansData, isLoading: plansLoading } = usePlans({ enabled: true });

  // Owners dropdown: reuse clients API (GYM_OWNER users)
  const { data: ownersData, isLoading: ownersLoading } = useQuery({
    queryKey: ["ownersDropdown"],
    queryFn: async () => {
      const res = await axios.post("/api/clients/getclients", { page: 1, limit: 200, search: "" });
      return res.data as { data: ClientOption[] };
    },
  });

  const owners = ownersData?.data ?? [];

  const ownerLabelById = useMemo(() => {
    const map = new Map<string, string>();
    owners.forEach((o) => {
      map.set(o.id, `${o.first_name} ${o.last_name}`.trim() + (o.email ? ` (${o.email})` : ""));
    });
    return map;
  }, [owners]);

  const createMutation = useMutation({
    mutationFn: (values: any) => axios.post("/api/subscription/createsubscription", values),
    onSuccess: () => {
      toast.success("Subscription created successfully");
      queryClient.invalidateQueries({ queryKey: ["ownerSubscriptions"] });
      router.push("/subscriptions");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: any) =>
      axios.post("/api/subscription/updatesubscription", { id: subscriptionId, ...values }),
    onSuccess: () => {
      toast.success("Subscription updated successfully");
      queryClient.invalidateQueries({ queryKey: ["ownerSubscriptions"] });
      router.push("/subscriptions");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const formik = useFormik({
    initialValues: {
      owner_id: subscriptionData?.owner_id || "",
      plan_id: subscriptionData?.plan_id || "",
      billing_model: subscriptionData?.billing_model || "",
      start_date: subscriptionData?.start_date
        ? new Date(subscriptionData.start_date).toISOString().slice(0, 10)
        : "",
    },
    validationSchema: ManageOwnerSubscriptionSchema,
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

  if (fetchingSubscription) return <FullScreenLoader label="Loading subscription..." />;

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
                  <SelectValue placeholder={ownersLoading ? "Loading..." : "Select owner"} />
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
                <p className="text-red-500 text-sm">{String(formik.errors.owner_id)}</p>
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
                  <SelectValue placeholder={plansLoading ? "Loading..." : "Select plan"} />
                </SelectTrigger>
                <SelectContent className="w-full">
                  {plansData?.data.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — Monthly: ${p.monthly_price} / Yearly: ${p.yearly_price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formik.touched.plan_id && formik.errors.plan_id && (
                <p className="text-red-500 text-sm">{String(formik.errors.plan_id)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Billing Model</Label>
              <Select
                value={formik.values.billing_model || ""}
                onValueChange={(val) => formik.setFieldValue("billing_model", val)}
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
                <p className="text-red-500 text-sm">{String(formik.errors.billing_model)}</p>
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
                <p className="text-red-500 text-sm">{String(formik.errors.start_date)}</p>
              )}
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            {action !== "view" ? (
              <>
                <Button type="submit" className="flex-1">
                  {action === "create" ? "Create Subscription" : "Update Subscription"}
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
