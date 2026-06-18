"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import axios from "axios";
import { GalleryVerticalEnd, CalendarIcon, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/date-helper-functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PhoneInput } from "@/components/ui/phone-input";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export function OnboardingForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const email = searchParams?.get("email") ?? "";
  const token = searchParams?.get("token") ?? "";

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
    date_of_birth: undefined as Date | undefined,
    address: "",
    city: "",
    state: "",
    zip_code: "",
    country: "",
    cnic: "",
    password: "",
    confirm_password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!email || !token) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md">
            <GalleryVerticalEnd className="size-6" />
          </div>
          <h1 className="text-xl font-bold">Invalid Invite Link</h1>
        </div>
        <Alert variant="destructive">
          <AlertDescription>
            Invalid or missing invite link. Please contact your administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match");
      return;
    }

    if (!form.date_of_birth) {
      setError("Date of birth is required");
      return;
    }

    setLoading(true);
    try {
      await axios.post("/api/clients/complete-invite", {
        token,
        email,
        first_name: form.first_name,
        last_name: form.last_name,
        phone_number: form.phone_number,
        date_of_birth: form.date_of_birth.toISOString(),
        address: form.address,
        city: form.city,
        state: form.state,
        zip_code: form.zip_code,
        country: form.country,
        cnic: form.cnic || undefined,
        password: form.password,
      });
      setSuccess(true);
      setTimeout(() => router.push("/sign-in"), 3000);
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col gap-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md">
            <GalleryVerticalEnd className="size-6" />
          </div>
          <h1 className="text-xl font-bold">Account setup complete!</h1>
          <p className="text-muted-foreground text-sm">
            Redirecting you to sign in...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-6" />
            </div>
            <h1 className="text-xl font-bold">Complete Your Profile</h1>
            <p className="text-muted-foreground text-center text-sm">
              Set up your gym owner account to get started.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                readOnly
                disabled
                className="opacity-60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="first_name">First name</Label>
              <Input
                id="first_name"
                name="first_name"
                placeholder="Enter first name"
                value={form.first_name}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Last name</Label>
              <Input
                id="last_name"
                name="last_name"
                placeholder="Enter last name"
                value={form.last_name}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Phone Number</Label>
              <PhoneInput
                placeholder="Enter phone number"
                value={form.phone_number}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, phone_number: value }))
                }
                defaultCountry="PK"
                international
                disabled={loading}
              />
            </div>

            <div className="flex flex-col gap-3">
              <Label htmlFor="date_of_birth" className="px-1">
                Date of birth
              </Label>
              <Popover>
                <PopoverTrigger className="w-full" asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loading}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.date_of_birth && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.date_of_birth ? (
                      formatDate(form.date_of_birth)
                    ) : (
                      <span>Pick your date of birth</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Calendar
                    className="w-full"
                    mode="single"
                    selected={form.date_of_birth}
                    onSelect={(date) =>
                      setForm((prev) => ({ ...prev, date_of_birth: date }))
                    }
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnic">CNIC (Optional)</Label>
              <Input
                id="cnic"
                name="cnic"
                placeholder="Enter CNIC"
                value={form.cnic}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                placeholder="Enter address"
                value={form.address}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                name="city"
                placeholder="Enter city"
                value={form.city}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                name="state"
                placeholder="Enter state"
                value={form.state}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zip_code">Zip Code</Label>
              <Input
                id="zip_code"
                name="zip_code"
                placeholder="Enter zip code"
                value={form.zip_code}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Country</Label>
              <CountryDropdown
                placeholder="Select country"
                defaultValue={form.country}
                disabled={loading}
                onChange={(country) => {
                  setForm((prev) => ({ ...prev, country: country.alpha3 }));
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <Input
                id="confirm_password"
                name="confirm_password"
                type="password"
                placeholder="Confirm password"
                value={form.confirm_password}
                onChange={handleChange}
                required
                minLength={6}
                disabled={loading}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              "Complete Setup"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
