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
import { useMemo, useState } from "react";
import { toast } from "sonner";

const AnnouncementSchema = Yup.object({
  title: Yup.string().required("Title is required"),
  message: Yup.string().required("Message is required"),
  audience: Yup.string().oneOf(["ALL", "GYM_OWNER", "MEMBER"]).required("Audience is required"),
  is_active: Yup.boolean(),
});

const ManageAnnouncementPage = () => {
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

  const initialAudience = useMemo(() => (action === "create" ? "ALL" : announcementData?.audience || "ALL"), [action, announcementData]);

  const formik = useFormik({
    initialValues: {
      title: announcementData?.title || "",
      message: announcementData?.message || "",
      audience: initialAudience,
      is_active: announcementData?.is_active ?? true,
    },
    validationSchema: AnnouncementSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
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
                value={formik.values.audience || "ALL"}
                onValueChange={(val) => formik.setFieldValue("audience", val)}
                disabled={action === "view"}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="GYM_OWNER">Gym Owners</SelectItem>
                  <SelectItem value="MEMBER">Members</SelectItem>
                </SelectContent>
              </Select>
              {formik.touched.audience && formik.errors.audience && (
                <p className="text-red-500 text-sm">{String(formik.errors.audience)}</p>
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

export default ManageAnnouncementPage;


