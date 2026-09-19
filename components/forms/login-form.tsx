"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean(),
});

type LoginValues = z.infer<typeof loginSchema>;

const fieldFocus =
  "focus-visible:border-primary-dim focus-visible:ring-0 focus-visible:shadow-[0_0_0_3px_var(--ring)]";

const inputStyles = cn(
  "h-11 rounded-md border-border bg-surface text-foreground shadow-none",
  "placeholder:text-faint md:text-sm",
  fieldFocus
);

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const router = useRouter();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: false,
    },
  });

  const onSubmit = async (values: LoginValues) => {
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        remember: values.remember ? "true" : "false",
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        return;
      }

      const updatedSession = await getSession();
      const userRole = updatedSession?.user?.role;

      if (userRole === "SUPER_ADMIN" || userRole === "GYM_OWNER") {
        router.push("/dashboard");
        router.refresh();
      } else {
        router.push("/unauthorized");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("w-full max-w-[380px]", className)} {...props}>
      <div className="mb-8">
        <h2 className="font-display text-[26px] leading-tight font-bold tracking-tight text-foreground">
          Sign in
        </h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">
          Enter your email and password to continue.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="gap-2">
                <FormLabel className="text-sm font-medium text-foreground">
                  Email
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@yourgym.com"
                    disabled={isLoading}
                    className={inputStyles}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="gap-2">
                <FormLabel className="text-sm font-medium text-foreground">
                  Password
                </FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      type={passwordVisible ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      disabled={isLoading}
                      className={cn(inputStyles, "pr-16")}
                      {...field}
                    />
                  </FormControl>
                  <button
                    type="button"
                    onClick={() => setPasswordVisible((prev) => !prev)}
                    disabled={isLoading}
                    aria-label={passwordVisible ? "Hide password" : "Show password"}
                    className={cn(
                      "absolute top-1/2 right-2.5 -translate-y-1/2 rounded px-1.5 py-0.5 text-xs font-medium text-muted-foreground",
                      "hover:text-foreground",
                      "focus-visible:shadow-[0_0_0_3px_var(--ring)] focus-visible:text-foreground",
                      "disabled:pointer-events-none disabled:opacity-50"
                    )}
                  >
                    {passwordVisible ? "Hide" : "Show"}
                  </button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center justify-between gap-3">
            <FormField
              control={form.control}
              name="remember"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      id="remember"
                      checked={field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true)
                      }
                      disabled={isLoading}
                      className={cn(
                        "size-4 rounded border-border bg-surface shadow-none",
                        "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
                        "focus-visible:border-primary-dim focus-visible:ring-0 focus-visible:shadow-[0_0_0_3px_var(--ring)]"
                      )}
                    />
                  </FormControl>
                  <Label
                    htmlFor="remember"
                    className="text-sm font-normal text-foreground"
                  >
                    Keep me signed in
                  </Label>
                </FormItem>
              )}
            />
            <span className="text-sm text-muted-foreground">
              Password reset is unavailable
            </span>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className={cn(
              "h-11 w-full rounded-[7px] bg-primary text-sm font-semibold text-primary-foreground",
              "hover:bg-primary-hover",
              "active:translate-y-px motion-reduce:active:translate-y-0",
              "focus-visible:border-primary-dim focus-visible:ring-0 focus-visible:shadow-[0_0_0_3px_var(--ring)]"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 motion-reduce:animate-none animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      </Form>

      <p className="mt-8 border-t border-border-soft pt-5 text-[13px] leading-relaxed text-faint">
        <span className="font-semibold text-foreground">New gym owner?</span>{" "}
        Accounts are set up by invite — ask your platform admin to send you one.
      </p>
    </div>
  );
}
