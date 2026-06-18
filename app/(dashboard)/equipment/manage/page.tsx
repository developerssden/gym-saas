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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useState, useMemo, useEffect, Suspense } from "react";
import { toast } from "sonner";
import { useSubscriptionValidation } from "@/hooks/useSubscriptionValidation";
import { SubscriptionLimitModal } from "@/components/subscription/SubscriptionLimitModal";
import { SubscriptionExpiredModal } from "@/components/subscription/SubscriptionExpiredModal";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const EquipmentSchema = Yup.object({
  name: Yup.string().required("Item Name is required"),
  category: Yup.string().required("Category is required"),
  type: Yup.string().required("Type is required"),
  quantity: Yup.number().required("Quantity is required").min(0, "Quantity must be 0 or greater"),
  condition: Yup.string(),
  status: Yup.string(),
  weight_value: Yup.number().min(0, "Weight must be 0 or greater"),
  weight_unit: Yup.string().oneOf(["kg", "lbs"]),
  brand: Yup.string(),
  purchase_date: Yup.date(),
  purchase_cost: Yup.number().min(0, "Purchase cost must be 0 or greater"),
  last_maintenance_date: Yup.date(),
  next_maintenance_due: Yup.date(),
});

const CATEGORIES = [
  { value: "CARDIO", label: "Cardio" },
  { value: "STRENGTH", label: "Strength" },
  { value: "FREE_WEIGHTS", label: "Free Weights" },
  { value: "ACCESSORIES", label: "Accessories" },
  { value: "CONSUMABLES", label: "Consumables" },
];

const CONDITIONS = [
  { value: "NEW", label: "New" },
  { value: "GOOD", label: "Good" },
  { value: "NEEDS_MAINTENANCE", label: "Needs Maintenance" },
  { value: "OUT_OF_ORDER", label: "Out of Order" },
];

const STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "IN_REPAIR", label: "In Repair" },
  { value: "RETIRED", label: "Retired" },
];

const WEIGHT_UNITS = [
  { value: "kg", label: "kg" },
  { value: "lbs", label: "lbs" },
] as const;

const parseWeight = (
  weightStr: string | null | undefined
): { value: string; unit: "kg" | "lbs" } => {
  if (!weightStr?.trim()) return { value: "", unit: "kg" };
  const trimmed = weightStr.trim();
  const lbsMatch = trimmed.match(/^([\d.]+)\s*(lbs?|lb\.?)$/i);
  if (lbsMatch) return { value: lbsMatch[1], unit: "lbs" };
  const kgMatch = trimmed.match(/^([\d.]+)\s*(kgs?|kg\.?)?$/i);
  if (kgMatch) return { value: kgMatch[1], unit: "kg" };
  const numMatch = trimmed.match(/^([\d.]+)/);
  if (numMatch) return { value: numMatch[1], unit: "kg" };
  return { value: "", unit: "kg" };
};

const formatWeight = (
  value: string | number,
  unit: "kg" | "lbs"
): string | undefined => {
  if (value === "" || value === null || value === undefined) return undefined;
  return `${value} ${unit}`;
};

const formatDate = (date: Date | string | undefined): string => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "PPP");
};

const ManageEquipmentContent = () => {
  const { data: session, status } = useSession({ required: true });
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const action = (searchParams?.get("action") as "create" | "edit" | "view") || "create";
  const equipmentId = searchParams?.get("id") || null;

  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { isSubscriptionActive, subscriptionExpired } = useSubscriptionValidation();
  const [limitExceeded, setLimitExceeded] = useState<{
    show: boolean;
    resourceType?: string;
    current?: number;
    max?: number;
  }>({ show: false });
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  const [purchaseDateOpen, setPurchaseDateOpen] = useState(false);
  const [lastMaintenanceDateOpen, setLastMaintenanceDateOpen] = useState(false);
  const [nextMaintenanceDateOpen, setNextMaintenanceDateOpen] = useState(false);

  const selectedGymIdFromSession = session?.user?.selected_gym_id;
  const selectedLocationIdFromSession = session?.user?.selected_location_id;

  const { data: equipmentData, isLoading: loadingEquipment } = useQuery({
    queryKey: ["equipment", equipmentId],
    queryFn: async () => {
      const res = await axios.post("/api/equipment/getequipment", { id: equipmentId });
      return res.data;
    },
    enabled: !!equipmentId && (action === "edit" || action === "view"),
  });

  useEffect(() => {
    if (equipmentData) {
      const hasAdvanced = !!(
        equipmentData.brand ||
        equipmentData.purchase_date ||
        equipmentData.purchase_cost ||
        equipmentData.last_maintenance_date ||
        equipmentData.next_maintenance_due
      );
      if (hasAdvanced) setShowAdvanced(true);
    }
  }, [equipmentData]);

  const createMutation = useMutation({
    mutationFn: async (values: any) => {
      return axios.post("/api/equipment/createequipment", values);
    },
    onSuccess: () => {
      toast.success("Equipment created successfully");
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      router.push("/equipment");
    },
    onError: (err: any) => {
      if (err.response?.data?.limitExceeded) {
        setLimitExceeded({
          show: true,
          resourceType: "equipment",
          current: err.response.data.current,
          max: err.response.data.max,
        });
      } else {
        toast.error(getErrorMessage(err));
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: any) => {
      return axios.post("/api/equipment/updateequipment", {
        id: equipmentId,
        ...values,
      });
    },
    onSuccess: () => {
      toast.success("Equipment updated successfully");
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({ queryKey: ["equipment", equipmentId] });
      router.push("/equipment");
    },
    onError: (err: any) => {
      if (err.response?.data?.limitExceeded) {
        setLimitExceeded({
          show: true,
          resourceType: "equipment",
          current: err.response.data.current,
          max: err.response.data.max,
        });
      } else {
        toast.error(getErrorMessage(err));
      }
    },
  });

  const gymId = action === "create" ? selectedGymIdFromSession : equipmentData?.gym_id || "";
  const locationId =
    action === "create" ? selectedLocationIdFromSession : equipmentData?.location_id || "";

  const initialValues = useMemo(() => {
    const parsedWeight = parseWeight(equipmentData?.weight);
    return {
      name: equipmentData?.name || "",
      category: equipmentData?.category || "",
      type: equipmentData?.type || "",
      quantity: equipmentData?.quantity ? Number(equipmentData.quantity) : "",
      condition: equipmentData?.condition || "",
      status: equipmentData?.status || "ACTIVE",
      weight_value: parsedWeight.value !== "" ? Number(parsedWeight.value) : "",
      weight_unit: parsedWeight.unit,
      brand: equipmentData?.brand || "",
      purchase_date: equipmentData?.purchase_date
        ? new Date(equipmentData.purchase_date)
        : undefined,
      purchase_cost: equipmentData?.purchase_cost || "",
      last_maintenance_date: equipmentData?.last_maintenance_date
        ? new Date(equipmentData.last_maintenance_date)
        : undefined,
      next_maintenance_due: equipmentData?.next_maintenance_due
        ? new Date(equipmentData.next_maintenance_due)
        : undefined,
    };
  }, [equipmentData]);

  const formik = useFormik({
    initialValues,
    validationSchema: EquipmentSchema,
    enableReinitialize: !!equipmentData,
    onSubmit: async (values) => {
      if (!isSubscriptionActive || subscriptionExpired) {
        setShowExpiredModal(true);
        return;
      }

      if (action === "create") {
        if (!selectedGymIdFromSession) {
          toast.error("Please select a gym and location from the header selector.");
          return;
        }
        if (!gymId) {
          toast.error("Gym is required. Please select a gym from the header selector.");
          return;
        }
      }

      setSaving(true);
      try {
        const submitValues: any = {
          name: values.name,
          category: values.category,
          type: values.type,
          quantity: String(values.quantity),
          condition: values.condition || undefined,
          status: values.status,
          weight: formatWeight(values.weight_value, values.weight_unit as "kg" | "lbs"),
          brand: values.brand || undefined,
          purchase_date: values.purchase_date?.toISOString(),
          purchase_cost: values.purchase_cost !== "" ? values.purchase_cost : undefined,
          last_maintenance_date: values.last_maintenance_date?.toISOString(),
          next_maintenance_due: values.next_maintenance_due?.toISOString(),
          gym_id: gymId,
          location_id: locationId || null,
        };

        if (!submitValues.gym_id) {
          toast.error("Gym is required.");
          setSaving(false);
          return;
        }

        if (action === "create") {
          await createMutation.mutateAsync(submitValues);
        } else if (action === "edit") {
          await updateMutation.mutateAsync(submitValues);
        }
      } catch {
        // Error is already handled in mutation onError
      } finally {
        setSaving(false);
      }
    },
  });

  const resetForm = () => {
    formik.resetForm();
  };

  if (status === "loading" || (loadingEquipment && action !== "create")) {
    return <FullScreenLoader />;
  }
  if (session?.user?.role !== "GYM_OWNER") {
    return redirect("/unauthorized");
  }

  const isViewMode = action === "view";
  const isDisabled = isViewMode || !isSubscriptionActive || subscriptionExpired;

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="h1">
            {action === "create"
              ? "Add Inventory Item"
              : action === "edit"
                ? "Update Inventory Item"
                : "View Inventory Item"}
          </h1>
          {!isViewMode && (
            <Button type="button" variant="outline" onClick={resetForm}>
              Reset Form
            </Button>
          )}
        </div>

        {action === "create" && !selectedGymIdFromSession && (
          <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Please select a gym and location from the header selector before creating equipment.
            </p>
          </div>
        )}

        {(action === "edit" || action === "view") && equipmentData && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="space-y-2">
              <Label>Gym</Label>
              <Input value={equipmentData.gym?.name || ""} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={equipmentData.location?.name || "None"}
                disabled
                className="bg-muted"
              />
            </div>
          </div>
        )}

        <form onSubmit={formik.handleSubmit} className="space-y-8">
          <div className="space-y-6 p-6 border rounded-lg bg-card">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  name="name"
                  value={formik.values.name}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={isDisabled}
                  placeholder="e.g., Treadmill Pro 5000"
                />
                {formik.touched.name && typeof formik.errors.name === "string" && (
                  <p className="text-sm text-red-500">{formik.errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formik.values.category}
                  onValueChange={(value) => formik.setFieldValue("category", value)}
                  disabled={isDisabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formik.touched.category && typeof formik.errors.category === "string" && (
                  <p className="text-sm text-red-500">{formik.errors.category}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Input
                  id="type"
                  name="type"
                  value={formik.values.type}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={isDisabled}
                  placeholder="e.g., Treadmill"
                />
                {formik.touched.type && typeof formik.errors.type === "string" && (
                  <p className="text-sm text-red-500">{formik.errors.type}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity Available *</Label>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min="0"
                  value={formik.values.quantity}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={isDisabled}
                  placeholder="0"
                />
                {formik.touched.quantity && formik.errors.quantity && (
                  <p className="text-sm text-red-500">{formik.errors.quantity}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="condition">Condition</Label>
                <Select
                  value={formik.values.condition}
                  onValueChange={(value) => formik.setFieldValue("condition", value)}
                  disabled={isDisabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((cond) => (
                      <SelectItem key={cond.value} value={cond.value}>
                        {cond.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formik.values.status}
                  onValueChange={(value) => formik.setFieldValue("status", value)}
                  disabled={isDisabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((statusOption) => (
                      <SelectItem key={statusOption.value} value={statusOption.value}>
                        {statusOption.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight_value">Weight (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="weight_value"
                    name="weight_value"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formik.values.weight_value}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    disabled={isDisabled}
                    placeholder="0"
                    className="flex-1"
                  />
                  <Select
                    value={formik.values.weight_unit}
                    onValueChange={(value) => formik.setFieldValue("weight_unit", value)}
                    disabled={isDisabled}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEIGHT_UNITS.map((unit) => (
                        <SelectItem key={unit.value} value={unit.value}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formik.touched.weight_value &&
                  typeof formik.errors.weight_value === "string" && (
                    <p className="text-sm text-red-500">{formik.errors.weight_value}</p>
                  )}
              </div>
            </div>
          </div>

          <div className="p-6 border rounded-lg bg-card">
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {showAdvanced ? "Hide advanced details" : "Show advanced details"}
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand / Manufacturer</Label>
                  <Input
                    id="brand"
                    name="brand"
                    value={formik.values.brand}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    disabled={isDisabled}
                    placeholder="e.g., Life Fitness"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Purchase Date</Label>
                  <Popover open={purchaseDateOpen} onOpenChange={setPurchaseDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formik.values.purchase_date && "text-muted-foreground"
                        )}
                        disabled={isDisabled}
                        type="button"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formik.values.purchase_date
                          ? formatDate(formik.values.purchase_date)
                          : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formik.values.purchase_date}
                        onSelect={(date) => {
                          if (date) {
                            formik.setFieldValue("purchase_date", date);
                            setPurchaseDateOpen(false);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="purchase_cost">Purchase Cost</Label>
                  <Input
                    id="purchase_cost"
                    name="purchase_cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formik.values.purchase_cost}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    disabled={isDisabled}
                    placeholder="0.00"
                  />
                  {formik.touched.purchase_cost &&
                    typeof formik.errors.purchase_cost === "string" && (
                      <p className="text-sm text-red-500">{formik.errors.purchase_cost}</p>
                    )}
                </div>

                <div className="space-y-2">
                  <Label>Last Maintenance Date</Label>
                  <Popover
                    open={lastMaintenanceDateOpen}
                    onOpenChange={setLastMaintenanceDateOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formik.values.last_maintenance_date && "text-muted-foreground"
                        )}
                        disabled={isDisabled}
                        type="button"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formik.values.last_maintenance_date
                          ? formatDate(formik.values.last_maintenance_date)
                          : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formik.values.last_maintenance_date}
                        onSelect={(date) => {
                          if (date) {
                            formik.setFieldValue("last_maintenance_date", date);
                            setLastMaintenanceDateOpen(false);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Next Maintenance Due</Label>
                  <Popover open={nextMaintenanceDateOpen} onOpenChange={setNextMaintenanceDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formik.values.next_maintenance_due && "text-muted-foreground"
                        )}
                        disabled={isDisabled}
                        type="button"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formik.values.next_maintenance_due
                          ? formatDate(formik.values.next_maintenance_due)
                          : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formik.values.next_maintenance_due}
                        onSelect={(date) => {
                          if (date) {
                            formik.setFieldValue("next_maintenance_due", date);
                            setNextMaintenanceDateOpen(false);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            {!isViewMode && (
              <>
                <Button
                  type="submit"
                  disabled={saving || (isDisabled && !subscriptionExpired)}
                  size="lg"
                  onClick={(e) => {
                    if (!isSubscriptionActive || subscriptionExpired) {
                      e.preventDefault();
                      setShowExpiredModal(true);
                    }
                  }}
                >
                  {saving
                    ? "Saving..."
                    : action === "create"
                      ? "Save Item"
                      : "Update Item"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()} size="lg">
                  Cancel
                </Button>
              </>
            )}

            {isViewMode && (
              <Button type="button" variant="outline" onClick={() => router.back()} size="lg">
                Back
              </Button>
            )}
          </div>
        </form>
      </div>

      <SubscriptionLimitModal
        open={limitExceeded.show}
        onClose={() => setLimitExceeded({ show: false })}
        limitInfo={{
          resourceType: limitExceeded.resourceType || "equipment",
          current: limitExceeded.current || 0,
          max: limitExceeded.max || 0,
        }}
      />
      <SubscriptionExpiredModal
        open={showExpiredModal}
        onClose={() => setShowExpiredModal(false)}
      />
    </PageContainer>
  );
};

const ManageEquipmentPage = () => {
  return (
    <Suspense fallback={<FullScreenLoader label="Loading..." />}>
      <ManageEquipmentContent />
    </Suspense>
  );
};

export default ManageEquipmentPage;
