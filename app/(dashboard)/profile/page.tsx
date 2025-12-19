/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { PageContainer } from "@/components/layout/page-container";
import { useRouter } from "next/navigation";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import axios from "axios";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDate } from "@/lib/date-helper-functions";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { cn } from "@/lib/utils";

const ProfileSchema = Yup.object({
  first_name: Yup.string().required("First name is required"),
  last_name: Yup.string().required("Last name is required"),
  phone_number: Yup.string().required("Phone number is required"),
  date_of_birth: Yup.date().required("Date of birth is required"),
  address: Yup.string().required("Address is required"),
  city: Yup.string().required("City is required"),
  state: Yup.string().required("State is required"),
  country: Yup.string().required("Country is required"),
  zip_code: Yup.string().required("Zip code is required"),
  cnic: Yup.string().notRequired(),
});

const PasswordSchema = Yup.object({
  current_password: Yup.string().required("Current password is required"),
  new_password: Yup.string()
    .min(6, "Password must be at least 6 characters")
    .required("New password is required"),
  confirm_password: Yup.string()
    .oneOf([Yup.ref("new_password")], "Passwords must match")
    .required("Please confirm your password"),
});

const ProfilePage = () => {
  const { data: session, status, update: updateSession } = useSession({ required: true });
  const router = useRouter();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [dateOfBirthOpen, setDateOfBirthOpen] = useState(false);

  // Fetch user data from API to ensure we have all fields
  const { data: userData, isLoading: fetchingUser } = useQuery({
    queryKey: ["profile", session?.user?.id],
    queryFn: async () => {
      const res = await axios.post("/api/profile/getprofile");
      return res.data;
    },
    enabled: !!session?.user?.id && status === "authenticated",
  });

  // Password update mutation (defined before passwordFormik to avoid closure issues)
  const updatePasswordMutation = useMutation({
    mutationFn: (values: { current_password: string; new_password: string }) =>
      axios.post("/api/profile/updatepassword", values),
    onSuccess: () => {
      toast.success("Password updated successfully");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: (values: any) => axios.post("/api/profile/updateprofile", values),
    onSuccess: async (res) => {
      toast.success("Profile updated successfully");
      // Update session with new data
      await updateSession({
        user: {
          ...session?.user,
          ...res.data.data,
        },
      });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  // Memoize initial values to prevent unnecessary re-initializations
  const initialProfileValues = useMemo(() => ({
    first_name: userData?.first_name || "",
    last_name: userData?.last_name || "",
    phone_number: userData?.phone_number || "",
    date_of_birth: userData?.date_of_birth
      ? new Date(userData.date_of_birth)
      : new Date(),
    address: userData?.address || "",
    city: userData?.city || "",
    state: userData?.state || "",
    country: userData?.country || "",
    zip_code: userData?.zip_code || "",
    cnic: userData?.cnic || "",
  }), [userData]);

  const profileFormik = useFormik({
    initialValues: initialProfileValues,
    validationSchema: ProfileSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setSaving(true);
      try {
        await updateProfileMutation.mutateAsync(values);
      } finally {
        setSaving(false);
      }
    },
  });

  const passwordFormik = useFormik({
    initialValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
    validationSchema: PasswordSchema,
    onSubmit: async (values) => {
      setChangingPassword(true);
      try {
        await updatePasswordMutation.mutateAsync({
          current_password: values.current_password,
          new_password: values.new_password,
        });
        // Reset form after successful password change
        passwordFormik.resetForm();
      } finally {
        setChangingPassword(false);
      }
    },
  });

  // Conditional returns after all hooks
  if (status === "loading" || fetchingUser) {
    return <FullScreenLoader />;
  }
  if (session?.user?.role !== "GYM_OWNER") {
    return redirect("/unauthorized");
  }

  return (
    <PageContainer>
      {saving && <FullScreenLoader label="Saving profile..." />}
      {changingPassword && <FullScreenLoader label="Updating password..." />}
      <div className="w-full space-y-12">
        <h1 className="h1 text-center">Profile Settings</h1>

        <Tabs defaultValue="profile" className="max-w-2xl mx-auto">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile Information</TabsTrigger>
            <TabsTrigger value="password">Change Password</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <form onSubmit={profileFormik.handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={userData?.email || ""}
                  disabled
                  className="bg-muted"
                  placeholder="Email (cannot be changed)"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed for security reasons
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input
                    name="first_name"
                    value={profileFormik.values.first_name}
                    onChange={profileFormik.handleChange}
                    onBlur={profileFormik.handleBlur}
                    placeholder="First name"
                  />
                  {profileFormik.touched.first_name && profileFormik.errors.first_name && (
                    <p className="text-red-500 text-sm">
                      {String(profileFormik.errors.first_name)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input
                    name="last_name"
                    value={profileFormik.values.last_name}
                    onChange={profileFormik.handleChange}
                    onBlur={profileFormik.handleBlur}
                    placeholder="Last name"
                  />
                  {profileFormik.touched.last_name && profileFormik.errors.last_name && (
                    <p className="text-red-500 text-sm">
                      {String(profileFormik.errors.last_name)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Phone Number *</Label>
                  <Input
                    name="phone_number"
                    value={profileFormik.values.phone_number}
                    onChange={profileFormik.handleChange}
                    onBlur={profileFormik.handleBlur}
                    placeholder="Phone number"
                  />
                  {profileFormik.touched.phone_number && profileFormik.errors.phone_number && (
                    <p className="text-red-500 text-sm">
                      {String(profileFormik.errors.phone_number)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Date of Birth *</Label>
                  <Popover open={dateOfBirthOpen} onOpenChange={setDateOfBirthOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !profileFormik.values.date_of_birth && "text-muted-foreground"
                        )}
                        type="button"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {profileFormik.values.date_of_birth
                          ? formatDate(profileFormik.values.date_of_birth)
                          : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={profileFormik.values.date_of_birth}
                        onSelect={(date) => {
                          if (date) {
                            profileFormik.setFieldValue("date_of_birth", date);
                            setDateOfBirthOpen(false);
                          }
                        }}
                        disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {profileFormik.touched.date_of_birth && profileFormik.errors.date_of_birth && (
                    <p className="text-red-500 text-sm">
                      {String(profileFormik.errors.date_of_birth)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>CNIC</Label>
                  <Input
                    name="cnic"
                    value={profileFormik.values.cnic}
                    onChange={profileFormik.handleChange}
                    onBlur={profileFormik.handleBlur}
                    placeholder="CNIC (optional)"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Address *</Label>
                <Input
                  name="address"
                  value={profileFormik.values.address}
                  onChange={profileFormik.handleChange}
                  onBlur={profileFormik.handleBlur}
                  placeholder="Address"
                />
                {profileFormik.touched.address && profileFormik.errors.address && (
                  <p className="text-red-500 text-sm">{String(profileFormik.errors.address)}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>City *</Label>
                  <Input
                    name="city"
                    value={profileFormik.values.city}
                    onChange={profileFormik.handleChange}
                    onBlur={profileFormik.handleBlur}
                    placeholder="City"
                  />
                  {profileFormik.touched.city && profileFormik.errors.city && (
                    <p className="text-red-500 text-sm">{String(profileFormik.errors.city)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>State *</Label>
                  <Input
                    name="state"
                    value={profileFormik.values.state}
                    onChange={profileFormik.handleChange}
                    onBlur={profileFormik.handleBlur}
                    placeholder="State"
                  />
                  {profileFormik.touched.state && profileFormik.errors.state && (
                    <p className="text-red-500 text-sm">{String(profileFormik.errors.state)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Zip Code *</Label>
                  <Input
                    name="zip_code"
                    value={profileFormik.values.zip_code}
                    onChange={profileFormik.handleChange}
                    onBlur={profileFormik.handleBlur}
                    placeholder="Zip code"
                  />
                  {profileFormik.touched.zip_code && profileFormik.errors.zip_code && (
                    <p className="text-red-500 text-sm">{String(profileFormik.errors.zip_code)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Country *</Label>
                  <CountryDropdown
                    placeholder="Select country"
                    defaultValue={profileFormik.values.country}
                    onChange={(country) => {
                      profileFormik.setFieldValue("country", country.alpha3);
                    }}
                  />
                  {profileFormik.touched.country && profileFormik.errors.country && (
                    <p className="text-red-500 text-sm">{String(profileFormik.errors.country)}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <Button type="submit" className="flex-1">
                  Update Profile
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="password" className="space-y-6">
            <form onSubmit={passwordFormik.handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>Current Password *</Label>
                <Input
                  name="current_password"
                  type="password"
                  value={passwordFormik.values.current_password}
                  onChange={passwordFormik.handleChange}
                  onBlur={passwordFormik.handleBlur}
                  placeholder="Enter current password"
                />
                {passwordFormik.touched.current_password &&
                  passwordFormik.errors.current_password && (
                    <p className="text-red-500 text-sm">
                      {String(passwordFormik.errors.current_password)}
                    </p>
                  )}
              </div>

              <div className="space-y-2">
                <Label>New Password *</Label>
                <Input
                  name="new_password"
                  type="password"
                  value={passwordFormik.values.new_password}
                  onChange={passwordFormik.handleChange}
                  onBlur={passwordFormik.handleBlur}
                  placeholder="Enter new password (min 6 characters)"
                />
                {passwordFormik.touched.new_password && passwordFormik.errors.new_password && (
                  <p className="text-red-500 text-sm">
                    {String(passwordFormik.errors.new_password)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Confirm New Password *</Label>
                <Input
                  name="confirm_password"
                  type="password"
                  value={passwordFormik.values.confirm_password}
                  onChange={passwordFormik.handleChange}
                  onBlur={passwordFormik.handleBlur}
                  placeholder="Confirm new password"
                />
                {passwordFormik.touched.confirm_password &&
                  passwordFormik.errors.confirm_password && (
                    <p className="text-red-500 text-sm">
                      {String(passwordFormik.errors.confirm_password)}
                    </p>
                  )}
              </div>

              <div className="flex gap-4 mt-6">
                <Button type="submit" className="flex-1">
                  Change Password
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => passwordFormik.resetForm()}
                >
                  Clear
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
};

export default ProfilePage;

