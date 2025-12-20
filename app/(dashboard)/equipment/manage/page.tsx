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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useState, useMemo, Suspense } from "react";
import { toast } from "sonner";
import { useSubscriptionValidation } from "@/hooks/useSubscriptionValidation";
import { SubscriptionLimitModal } from "@/components/subscription/SubscriptionLimitModal";
import { CalendarIcon, Upload, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const EquipmentSchema = Yup.object({
  name: Yup.string().required("Item Name is required"),
  category: Yup.string().required("Category is required"),
  brand: Yup.string(),
  model_number: Yup.string(),
  serial_number: Yup.string(),
  quantity: Yup.number().required("Quantity is required").min(0, "Quantity must be 0 or greater"),
  min_stock_level: Yup.number().min(0, "Minimum stock level must be 0 or greater"),
  condition: Yup.string(),
  purchase_date: Yup.date(),
  purchase_cost: Yup.number().min(0, "Purchase cost must be 0 or greater"),
  supplier_name: Yup.string(),
  last_maintenance_date: Yup.date(),
  next_maintenance_due: Yup.date(),
  maintenance_notes: Yup.string(),
  usage_frequency: Yup.string(),
  equipment_location: Yup.string(),
  status: Yup.string(),
  type: Yup.string().required("Type is required"),
  weight: Yup.string(),
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

const USAGE_FREQUENCIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

const EQUIPMENT_LOCATIONS = [
  "Cardio Area",
  "Weight Room",
  "Storage",
  "Yoga Studio",
  "Locker Room",
  "Reception",
  "Other",
];

const STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "IN_REPAIR", label: "In Repair" },
  { value: "RETIRED", label: "Retired" },
];

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
  const { isSubscriptionActive, subscriptionExpired } = useSubscriptionValidation();
  const [limitExceeded, setLimitExceeded] = useState<{
    show: boolean;
    resourceType?: string;
    current?: number;
    max?: number;
  }>({ show: false });

  // Date picker states
  const [purchaseDateOpen, setPurchaseDateOpen] = useState(false);
  const [lastMaintenanceDateOpen, setLastMaintenanceDateOpen] = useState(false);
  const [nextMaintenanceDateOpen, setNextMaintenanceDateOpen] = useState(false);

  // File upload states
  const [itemImage, setItemImage] = useState<File | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [itemImagePreview, setItemImagePreview] = useState<string | null>(null);
  const [invoicePreview, setInvoicePreview] = useState<string | null>(null);

  // Get selected gym and location from session
  const selectedGymIdFromSession = session?.user?.selected_gym_id;
  const selectedLocationIdFromSession = session?.user?.selected_location_id;

  // Fetch equipment data
  const { data: equipmentData, isLoading: loadingEquipment } = useQuery({
    queryKey: ["equipment", equipmentId],
    queryFn: async () => {
      const res = await axios.post("/api/equipment/getequipment", { id: equipmentId });
      return res.data;
    },
    enabled: !!equipmentId && (action === "edit" || action === "view"),
  });

  // Initialize image previews from equipment data
  useMemo(() => {
    if (equipmentData?.image_url) {
      setItemImagePreview(equipmentData.image_url);
    }
    if (equipmentData?.invoice_url) {
      setInvoicePreview(equipmentData.invoice_url);
    }
  }, [equipmentData]);

  const createMutation = useMutation({
    mutationFn: async (values: any) => {
      // For now, we'll send JSON. File uploads can be handled separately later
      // TODO: Implement file upload to storage service (e.g., S3, Cloudinary) and store URLs
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
      // For now, we'll send JSON. File uploads can be handled separately later
      // TODO: Implement file upload to storage service (e.g., S3, Cloudinary) and store URLs
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

  // Determine gym_id and location_id based on action
  const gymId = action === "create" ? selectedGymIdFromSession : equipmentData?.gym_id || "";
  const locationId = action === "create" ? selectedLocationIdFromSession : equipmentData?.location_id || "";

  // Memoize initial values
  const initialValues = useMemo(
    () => ({
      name: equipmentData?.name || "",
      category: equipmentData?.category || "",
      brand: equipmentData?.brand || "",
      model_number: equipmentData?.model_number || "",
      serial_number: equipmentData?.serial_number || "",
      quantity: equipmentData?.quantity ? Number(equipmentData.quantity) : "",
      min_stock_level: equipmentData?.min_stock_level || "",
      condition: equipmentData?.condition || "",
      purchase_date: equipmentData?.purchase_date ? new Date(equipmentData.purchase_date) : undefined,
      purchase_cost: equipmentData?.purchase_cost || "",
      supplier_name: equipmentData?.supplier_name || "",
      last_maintenance_date: equipmentData?.last_maintenance_date
        ? new Date(equipmentData.last_maintenance_date)
        : undefined,
      next_maintenance_due: equipmentData?.next_maintenance_due
        ? new Date(equipmentData.next_maintenance_due)
        : undefined,
      maintenance_notes: equipmentData?.maintenance_notes || "",
      usage_frequency: equipmentData?.usage_frequency || "",
      equipment_location: equipmentData?.equipment_location || "",
      status: equipmentData?.status || "ACTIVE",
      type: equipmentData?.type || "",
      weight: equipmentData?.weight || "",
    }),
    [equipmentData]
  );

  const formik = useFormik({
    initialValues,
    validationSchema: EquipmentSchema,
    enableReinitialize: !!equipmentData,
    onSubmit: async (values) => {
      if (!isSubscriptionActive || subscriptionExpired) {
        toast.error("Your subscription is expired. Please renew to continue.");
        return;
      }

      // Validate gym and location selection for create action
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
          ...values,
          quantity: String(values.quantity), // Convert to string for API
          gym_id: gymId,
          location_id: locationId || null,
        };

        // Convert dates to ISO strings
        if (submitValues.purchase_date) {
          submitValues.purchase_date = submitValues.purchase_date.toISOString();
        }
        if (submitValues.last_maintenance_date) {
          submitValues.last_maintenance_date = submitValues.last_maintenance_date.toISOString();
        }
        if (submitValues.next_maintenance_due) {
          submitValues.next_maintenance_due = submitValues.next_maintenance_due.toISOString();
        }

        // Double-check gym_id is present
        if (!submitValues.gym_id) {
          toast.error("Gym is required.");
          setSaving(false);
          return;
        }

        if (action === "create") {
          await createMutation.mutateAsync(submitValues);
        } else if (action === "edit") {
          await updateMutation.mutateAsync({
            id: equipmentId,
            ...submitValues,
          });
        }
      } catch (error) {
        // Error is already handled in mutation onError
      } finally {
        setSaving(false);
      }
    },
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setItemImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setItemImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInvoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInvoiceFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setInvoicePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setItemImage(null);
    setItemImagePreview(null);
    formik.setFieldValue("image_url", "");
  };

  const removeInvoice = () => {
    setInvoiceFile(null);
    setInvoicePreview(null);
    formik.setFieldValue("invoice_url", "");
  };

  const resetForm = () => {
    formik.resetForm();
    setItemImage(null);
    setInvoiceFile(null);
    setItemImagePreview(null);
    setInvoicePreview(null);
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
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="space-y-2">
                <Label>Gym</Label>
                <Input
                  value={equipmentData.gym?.name || ""}
                  disabled
                  className="bg-muted"
                />
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
          </>
        )}

        <form onSubmit={formik.handleSubmit} className="space-y-8">
          {/* Section 1: Basic Item Information */}
          <div className="space-y-6 p-6 border rounded-lg bg-card">
            <h2 className="text-xl font-semibold">1. Basic Item Information</h2>
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
                <Label htmlFor="model_number">Model Number</Label>
                <Input
                  id="model_number"
                  name="model_number"
                  value={formik.values.model_number}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={isDisabled}
                  placeholder="e.g., LF-5000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="serial_number">Serial Number</Label>
                <Input
                  id="serial_number"
                  name="serial_number"
                  value={formik.values.serial_number}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={isDisabled}
                  placeholder="e.g., SN123456789"
                />
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
            </div>
          </div>

          {/* Section 2: Inventory Details */}
          <div className="space-y-6 p-6 border rounded-lg bg-card">
            <h2 className="text-xl font-semibold">2. Inventory Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <Label htmlFor="min_stock_level">Minimum Stock Level</Label>
                <Input
                  id="min_stock_level"
                  name="min_stock_level"
                  type="number"
                  min="0"
                  value={formik.values.min_stock_level}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={isDisabled}
                  placeholder="0"
                />
                {formik.touched.min_stock_level && typeof formik.errors.min_stock_level === "string" && (
                  <p className="text-sm text-red-500">{formik.errors.min_stock_level}</p>
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
                {formik.touched.purchase_cost && typeof formik.errors.purchase_cost === "string" && (
                  <p className="text-sm text-red-500">{formik.errors.purchase_cost}</p>
                )}
                <Label htmlFor="supplier_name">Supplier Name</Label>
                <Input
                  id="supplier_name"
                  name="supplier_name"
                  value={formik.values.supplier_name}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={isDisabled}
                  placeholder="e.g., Fitness Supply Co."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">Weight (Optional)</Label>
                <Input
                  id="weight"
                  name="weight"
                  value={formik.values.weight}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={isDisabled}
                  placeholder="e.g., 50kg"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Maintenance & Usage */}
          <div className="space-y-6 p-6 border rounded-lg bg-card">
            <h2 className="text-xl font-semibold">3. Maintenance & Usage</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Last Maintenance Date</Label>
                <Popover open={lastMaintenanceDateOpen} onOpenChange={setLastMaintenanceDateOpen}>
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

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="maintenance_notes">Maintenance Notes</Label>
                <Textarea
                  id="maintenance_notes"
                  name="maintenance_notes"
                  value={formik.values.maintenance_notes}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={isDisabled}
                  placeholder="Enter maintenance notes, issues, or service history..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="usage_frequency">Usage Frequency</Label>
                <Select
                  value={formik.values.usage_frequency}
                  onValueChange={(value) => formik.setFieldValue("usage_frequency", value)}
                  disabled={isDisabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {USAGE_FREQUENCIES.map((freq) => (
                      <SelectItem key={freq.value} value={freq.value}>
                        {freq.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Section 4: Location & Status */}
          <div className="space-y-6 p-6 border rounded-lg bg-card">
            <h2 className="text-xl font-semibold">4. Location & Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="equipment_location">Equipment Location</Label>
                <Select
                  value={formik.values.equipment_location}
                  onValueChange={(value) => formik.setFieldValue("equipment_location", value)}
                  disabled={isDisabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT_LOCATIONS.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
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
                    {STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Section 5: Attachments */}
          <div className="space-y-6 p-6 border rounded-lg bg-card">
            <h2 className="text-xl font-semibold">5. Attachments</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Label htmlFor="item_image">Item Image</Label>
                <div className="space-y-2">
                  <Input
                    id="item_image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isDisabled}
                    className="cursor-pointer"
                  />
                  {itemImagePreview && (
                    <div className="relative w-full h-48 border rounded-lg overflow-hidden">
                      <img
                        src={itemImagePreview}
                        alt="Item preview"
                        className="w-full h-full object-cover"
                      />
                      {!isDisabled && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={removeImage}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <Label htmlFor="invoice_file">Invoice / Warranty (Optional)</Label>
                <div className="space-y-2">
                  <Input
                    id="invoice_file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleInvoiceUpload}
                    disabled={isDisabled}
                    className="cursor-pointer"
                  />
                  {invoicePreview && (
                    <div className="relative w-full h-48 border rounded-lg overflow-hidden">
                      {invoicePreview.endsWith(".pdf") ? (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <p className="text-sm text-muted-foreground">PDF Document</p>
                        </div>
                      ) : (
                        <img
                          src={invoicePreview}
                          alt="Invoice preview"
                          className="w-full h-full object-cover"
                        />
                      )}
                      {!isDisabled && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={removeInvoice}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            {!isViewMode && (
              <>
                <Button type="submit" disabled={saving || isDisabled} size="lg">
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
