/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import FullScreenLoader from "@/components/common/FullScreenLoader";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { AnnouncementRecipientPicker } from "@/components/SuperAdmin/announcement/recipient-picker";

const AnnouncementSchema = Yup.object({
  title: Yup.string().required("Title is required"),
  message: Yup.string().required("Message is required"),
  audienceMode: Yup.string()
    .oneOf(["ALL", "GYM_OWNER", "MEMBER", "INDIVIDUAL_GYM_OWNER", "INDIVIDUAL_MEMBER"])
    .required("Audience is required"),
  recipient_user_id: Yup.string(),
  is_active: Yup.boolean(),
}).test("recipient-required", "Select a recipient", function (values) {
  if (
    values?.audienceMode === "INDIVIDUAL_GYM_OWNER" ||
    values?.audienceMode === "INDIVIDUAL_MEMBER"
  ) {
    if (!values.recipient_user_id) {
      return this.createError({
        path: "recipient_user_id",
        message: "Select a gym owner or member to email",
      });
    }
  }
  return true;
});

const ManageAnnouncementContent = () => {
  const { data: session, status } = useSession({ required: true });
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const action = (searchParams?.get("action") as "create" | "edit" | "view") || "create";
  const announcementId = searchParams?.get("id") || null;

  const [saving, setSaving] = useState(false);
  const isSuperAdmin = status === "authenticated" && session?.user?.role === "SUPER_ADMIN";

  const { data: announcementData, isLoading: fetchingAnnouncement } = useQuery({
    queryKey: ["announcement", announcementId],
    queryFn: async () => {
      if (!announcementId) return null;
      const res = await axios.post("/api/announcements/getannouncement", { id: announcementId });
      return res.data;
    },
    enabled: isSuperAdmin && !!announcementId && action !== "create",
  });

  const createMutation = useMutation({
    mutationFn: (values: any) => axios.post("/api/announcements/createannouncement", values),
    onSuccess: () => {
      toast.success("Announcement created successfully");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      router.push("/announcements");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: any) => axios.post("/api/announcements/updateannouncement", { id: announcementId, ...values }),
    onSuccess: () => {
      toast.success("Announcement updated successfully");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      router.push("/announcements");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const initialAudienceMode = useMemo(() => {
    if (action === "create") return "ALL";
    if (announcementData?.recipient_user_id && announcementData?.audience === "MEMBER") {
      return "INDIVIDUAL_MEMBER";
    }
    if (announcementData?.recipient_user_id && announcementData?.audience === "GYM_OWNER") {
      return "INDIVIDUAL_GYM_OWNER";
    }
    return announcementData?.audience || "ALL";
  }, [action, announcementData]);

  const formik = useFormik({
    initialValues: {
      title: announcementData?.title || "",
      message: announcementData?.message || "",
      audienceMode: initialAudienceMode,
      recipient_user_id: announcementData?.recipient_user_id || "",
      is_active: announcementData?.is_active ?? true,
    },
    validationSchema: AnnouncementSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setSaving(true);
      try {
        const isIndividual =
          values.audienceMode === "INDIVIDUAL_GYM_OWNER" ||
          values.audienceMode === "INDIVIDUAL_MEMBER";
        const payload = {
          title: values.title,
          message: values.message,
          is_active: values.is_active,
          audience:
            values.audienceMode === "INDIVIDUAL_MEMBER"
              ? "MEMBER"
              : values.audienceMode === "INDIVIDUAL_GYM_OWNER"
                ? "GYM_OWNER"
                : values.audienceMode,
          recipient_user_id: isIndividual ? values.recipient_user_id : null,
        };
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
  if (fetchingAnnouncement) return <FullScreenLoader label="Loading announcement..." />;

  return (
    <PageContainer>
      {saving && <FullScreenLoader label="Saving announcement..." />}
      <div className="w-full space-y-12">
        <h1 className="h1 text-center">
          {action === "create" ? "Create Announcement" : action === "edit" ? "Edit Announcement" : "View Announcement"}
        </h1>

        <form className="max-w-2xl mx-auto" onSubmit={formik.handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            <div className="space-y-2 md:col-span-2">
              <Label>Title *</Label>
              <Input
                name="title"
                value={formik.values.title}
                onChange={formik.handleChange}
                disabled={action === "view"}
                placeholder="Announcement title"
              />
              {formik.touched.title && formik.errors.title && (
                <p className="text-red-500 text-sm">{String(formik.errors.title)}</p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Message *</Label>
              <Textarea
                name="message"
                value={formik.values.message}
                onChange={formik.handleChange}
                disabled={action === "view"}
                placeholder="Announcement message"
                rows={5}
              />
              {formik.touched.message && formik.errors.message && (
                <p className="text-red-500 text-sm">{String(formik.errors.message)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Audience *</Label>
              <Select
                value={formik.values.audienceMode || "ALL"}
                onValueChange={(val) => {
                  formik.setFieldValue("audienceMode", val);
                  if (val !== "INDIVIDUAL_GYM_OWNER" && val !== "INDIVIDUAL_MEMBER") {
                    formik.setFieldValue("recipient_user_id", "");
                  } else if (
                    (val === "INDIVIDUAL_GYM_OWNER" && formik.values.audienceMode !== "INDIVIDUAL_GYM_OWNER") ||
                    (val === "INDIVIDUAL_MEMBER" && formik.values.audienceMode !== "INDIVIDUAL_MEMBER")
                  ) {
                    formik.setFieldValue("recipient_user_id", "");
                  }
                }}
                disabled={action === "view"}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All gym owners and members</SelectItem>
                  <SelectItem value="GYM_OWNER">All gym owners</SelectItem>
                  <SelectItem value="MEMBER">All members</SelectItem>
                  <SelectItem value="INDIVIDUAL_GYM_OWNER">One gym owner</SelectItem>
                  <SelectItem value="INDIVIDUAL_MEMBER">One member</SelectItem>
                </SelectContent>
              </Select>
              {formik.touched.audienceMode && formik.errors.audienceMode && (
                <p className="text-red-500 text-sm">{String(formik.errors.audienceMode)}</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Label>Active</Label>
              <Switch
                checked={formik.values.is_active}
                onCheckedChange={(val) => formik.setFieldValue("is_active", val)}
                disabled={action === "view"}
              />
            </div>

            {(formik.values.audienceMode === "INDIVIDUAL_GYM_OWNER" ||
              formik.values.audienceMode === "INDIVIDUAL_MEMBER") && (
              <div className="space-y-2 md:col-span-2">
                <Label>
                  {formik.values.audienceMode === "INDIVIDUAL_GYM_OWNER"
                    ? "Gym owner *"
                    : "Member *"}
                </Label>
                <AnnouncementRecipientPicker
                  role={
                    formik.values.audienceMode === "INDIVIDUAL_GYM_OWNER"
                      ? "GYM_OWNER"
                      : "MEMBER"
                  }
                  value={formik.values.recipient_user_id}
                  onChange={(userId) => formik.setFieldValue("recipient_user_id", userId)}
                  disabled={action === "view"}
                  selectedRecipient={announcementData?.recipient ?? null}
                />
                {formik.touched.recipient_user_id && formik.errors.recipient_user_id && (
                  <p className="text-red-500 text-sm">{String(formik.errors.recipient_user_id)}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-4 mt-6">
            {action !== "view" ? (
              <>
                <Button type="submit" className="flex-1">
                  {action === "create" ? "Create Announcement" : "Update Announcement"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push("/announcements")}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" className="w-full" onClick={() => router.push("/announcements")}>
                Back
              </Button>
            )}
          </div>
        </form>
      </div>
    </PageContainer>
  );
};

const ManageAnnouncementPage = () => {
  return (
    <Suspense fallback={<FullScreenLoader label="Loading..." />}>
      <ManageAnnouncementContent />
    </Suspense>
  );
};

export default ManageAnnouncementPage;

