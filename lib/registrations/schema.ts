import { z } from "zod";

export const CITY_OPTIONS = ["Gujrat", "Lahore", "Other"] as const;
export const MEMBER_COUNT_OPTIONS = ["Under 100", "100–300", "300–500", "500+"] as const;

export const REGISTRATION_STATUSES = ["NEW", "CONTACTED", "ONBOARDED", "CLOSED"] as const;
export type RegistrationStatusValue = (typeof REGISTRATION_STATUSES)[number];

/** Shared by the landing-page form and /api/registrations/create. */
export const gymRegistrationSchema = z.object({
  owner_name: z.string().trim().min(2, "Please enter your name").max(100, "That name is too long"),
  gym_name: z.string().trim().min(2, "Please enter your gym's name").max(120, "That name is too long"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s-]{8,15}$/, "Please enter a valid phone number, e.g. 0301 2345678"),
  city: z.enum(CITY_OPTIONS, { error: "Please choose your city" }),
  member_count: z.enum(MEMBER_COUNT_OPTIONS).optional().or(z.literal("")),
  message: z.string().trim().max(1000, "Please keep your message under 1000 characters").optional().or(z.literal("")),
});

export type GymRegistrationInput = z.infer<typeof gymRegistrationSchema>;

/**
 * Normalises a Pakistani phone number to +92XXXXXXXXXX so the same number typed
 * as "0301 2345678", "+92 301 2345678" or "0092-301-2345678" is treated as one.
 */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `92${digits.slice(1)}`;
  return `+${digits}`;
}
