// Accepting an invite (owner or staff): only name, phone and a password. Pure (tested).
import { PASSWORD_MIN_LENGTH } from "@/lib/profile";

export type OnboardingValues = {
  first_name: string;
  last_name: string;
  phone_number: string;
  password: string;
  confirm_password: string;
};

type PasswordFieldErrors = Partial<Record<"password" | "confirm_password", string>>;

/** A new password and its confirmation (onboarding and reset). */
export function newPasswordErrors(password: string, confirm: string): PasswordFieldErrors {
  const errors: PasswordFieldErrors = {};
  if (!password) errors.password = "Choose a password";
  else if (password.length < PASSWORD_MIN_LENGTH) errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters`;
  if (password && confirm !== password) errors.confirm_password = "The two passwords don't match";
  return errors;
}

export type OnboardingErrors = Partial<Record<keyof OnboardingValues, string>>;

export function onboardingErrors(values: OnboardingValues): OnboardingErrors {
  const errors: OnboardingErrors = {};
  if (!values.first_name.trim()) errors.first_name = "Enter your first name";
  const digits = values.phone_number.replace(/\D/g, "");
  if (!digits) errors.phone_number = "Enter your phone number";
  else if (digits.length < 7) errors.phone_number = "That number looks too short";
  return { ...errors, ...newPasswordErrors(values.password, values.confirm_password) };
}

/** What the complete-invite API needs; anything else (address, date of birth) can be added later in Profile. */
export function missingInviteFields(body: { first_name?: unknown; phone_number?: unknown }): string[] {
  const filled = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  return [
    ...(filled(body.first_name) ? [] : ["first_name"]),
    ...(filled(body.phone_number) ? [] : ["phone_number"]),
  ];
}
