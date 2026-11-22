// Shared Prisma selects for API responses, so each screen gets only the fields
// it shows (issue #25). Keep the nesting the UI expects: member.user.first_name,
// member.gym.name / .country, member.user.phone_number for WhatsApp, etc.
import type { Prisma } from "@/prisma/generated/client";

/** A member's name and contact details, for lists, pickers and WhatsApp actions. */
export const memberListUserSelect = {
  id: true,
  first_name: true,
  last_name: true,
  email: true,
  phone_number: true,
} satisfies Prisma.UserSelect;

/** Everything the member edit form shows and edits. */
export const memberProfileUserSelect = {
  ...memberListUserSelect,
  date_of_birth: true,
  address: true,
  city: true,
  state: true,
  country: true,
  zip_code: true,
  cnic: true,
} satisfies Prisma.UserSelect;

/** Gym name, and country for the currency. */
export const gymSummarySelect = { id: true, name: true, country: true } satisfies Prisma.GymSelect;

/** Location name, and country for the currency. */
export const locationSummarySelect = { id: true, name: true, country: true } satisfies Prisma.LocationSelect;

/** A member row: its own ids plus name, contact, gym and location. */
export const memberListSelect = {
  id: true,
  user_id: true,
  gym_id: true,
  location_id: true,
  joinedAt: true,
  user: { select: memberListUserSelect },
  gym: { select: gymSummarySelect },
  location: { select: locationSummarySelect },
} satisfies Prisma.MemberSelect;

/** Who recorded a payment ("Ali Khan (staff)"). */
export const recordedBySelect = { id: true, first_name: true, last_name: true, role: true } satisfies Prisma.UserSelect;

/** A gym owner as shown on platform (owner subscription) payments. */
export const ownerSummarySelect = {
  id: true,
  first_name: true,
  last_name: true,
  email: true,
  phone_number: true,
  country: true,
} satisfies Prisma.UserSelect;
