/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import FullScreenLoader from "@/components/common/FullScreenLoader";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useState, Suspense } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

const TodoSchema = Yup.object({
  title: Yup.string().required("Title is required"),
  description: Yup.string().required("Description is required"),
});

const ManageTodoContent = () => {
  const { data: session, status } = useSession({ required: true });
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const action = (searchParams?.get("action") as "create" | "edit" | "view") || "create";
  const todoId = searchParams?.get("id") || null;

  const [saving, setSaving] = useState(false);

  const { data: todoData, isLoading: loadingTodo } = useQuery({
    queryKey: ["todo", todoId],
    queryFn: async () => {
      const res = await axios.post("/api/todos/gettodo", { id: todoId });
      return res.data;
    },
    enabled: !!todoId && (action === "edit" || action === "view"),
  });

  const createMutation = useMutation({
    mutationFn: (values: any) => axios.post("/api/todos/createtodo", values),
    onSuccess: () => {
      toast.success("Todo created successfully");
      queryClient.invalidateQueries({ queryKey: ["todos"] });
      router.push("/todos");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: any) => axios.post("/api/todos/updatetodo", values),
    onSuccess: () => {
      toast.success("Todo updated successfully");
      queryClient.invalidateQueries({ queryKey: ["todos"] });
      queryClient.invalidateQueries({ queryKey: ["todo", todoId] });
      router.push("/todos");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const formik = useFormik({
    initialValues: {
      title: todoData?.title || "",
      description: todoData?.description || "",
      is_completed: todoData?.is_completed || false,
    },
    validationSchema: TodoSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setSaving(true);
      try {
        if (action === "create") {
          await createMutation.mutateAsync({
            title: values.title,
            description: values.description,
          });
        } else if (action === "edit") {
          await updateMutation.mutateAsync({
            id: todoId,
            ...values,
          });
        }
      } finally {
        setSaving(false);
      }
    },
  });

  if (status === "loading" || (loadingTodo && action !== "create")) {
    return <FullScreenLoader />;
  }
  if (session?.user?.role !== "GYM_OWNER") {
    return redirect("/unauthorized");
  }

  const isViewMode = action === "view";

  return (
    <PageContainer>
      <div className="max-w-2xl mx-auto">
        <h1 className="h1 mb-6">
          {action === "create" ? "Create Todo" : action === "edit" ? "Edit Todo" : "View Todo"}
        </h1>

        <form onSubmit={formik.handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              name="title"
              value={formik.values.title}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              disabled={isViewMode}
              placeholder="Enter todo title"
            />
            {formik.touched.title && typeof formik.errors.title === 'string' && (
              <p className="text-sm text-red-500">{formik.errors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <textarea
              id="description"
              name="description"
              value={formik.values.description}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              disabled={isViewMode}
              placeholder="Enter todo description"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {formik.touched.description && typeof formik.errors.description === 'string' && (
              <p className="text-sm text-red-500">{formik.errors.description}</p>
            )}
          </div>

          {action !== "create" && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_completed"
                checked={formik.values.is_completed}
                onCheckedChange={(checked) =>
                  formik.setFieldValue("is_completed", checked)
                }
                disabled={isViewMode}
              />
              <Label htmlFor="is_completed" className="cursor-pointer">
                Mark as completed
              </Label>
            </div>
          )}

          {!isViewMode && (
            <div className="flex gap-4">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : action === "create" ? "Create Todo" : "Update Todo"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          )}

          {isViewMode && (
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Back
            </Button>
          )}
        </form>
      </div>
    </PageContainer>
  );
};

const ManageTodoPage = () => {
  return (
    <Suspense fallback={<FullScreenLoader label="Loading..." />}>
      <ManageTodoContent />
    </Suspense>
  );
};

export default ManageTodoPage;

