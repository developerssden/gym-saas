// Profile → Account and Password: validation and the payload sent to the API.
// Pure (tested). Only first name and phone are required; email can't be changed.

export type AccountValues = {
  first_name: string;
  last_name: string;
  phone_number: string;
  /** yyyy-MM-dd from <input type="date">, or "". */
  date_of_birth: string;
  cnic: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  /** ISO alpha-3, or "". */
  country: string;
};

export type AccountErrors = Partial<Record<"first_name" | "phone_number" | "date_of_birth", string>>;

export function accountErrors(values: AccountValues, today = new Date()): AccountErrors {
  const errors: AccountErrors = {};
  if (!values.first_name.trim()) errors.first_name = "Enter your first name";
  const phone = values.phone_number.trim();
  if (!phone) errors.phone_number = "Enter your phone number";
  else if (phone.replace(/\D/g, "").length < 7) errors.phone_number = "That number looks too short";
  if (values.date_of_birth) {
    const dob = new Date(values.date_of_birth);
    if (Number.isNaN(dob.getTime())) errors.date_of_birth = "That date doesn't look right";
    else if (dob.getTime() > today.getTime()) errors.date_of_birth = "Date of birth can't be in the future";
  }
  return errors;
}

/** Trimmed; empty optional fields are sent as null so they're cleared, not saved as "". */
export function accountPayload(values: AccountValues) {
  const optional = (v: string) => v.trim() || null;
  return {
    first_name: values.first_name.trim(),
    last_name: optional(values.last_name),
    phone_number: values.phone_number.trim(),
    date_of_birth: values.date_of_birth || null,
    cnic: optional(values.cnic),
    address: optional(values.address),
    city: optional(values.city),
    state: optional(values.state),
    zip_code: optional(values.zip_code),
    country: optional(values.country),
  };
}

type StoredUser = Partial<Record<keyof AccountValues, string | null>> & { date_of_birth?: string | null };

/** Form values from the saved profile. A missing date of birth stays empty (not today). */
export function accountValuesFrom(user: StoredUser | null | undefined): AccountValues {
  const s = (v: string | null | undefined) => v ?? "";
  return {
    first_name: s(user?.first_name),
    last_name: s(user?.last_name),
    phone_number: s(user?.phone_number),
    date_of_birth: user?.date_of_birth ? user.date_of_birth.slice(0, 10) : "",
    cnic: s(user?.cnic),
    address: s(user?.address),
    city: s(user?.city),
    state: s(user?.state),
    zip_code: s(user?.zip_code),
    country: s(user?.country),
  };
}

export const PASSWORD_MIN_LENGTH = 6;

export type PasswordValues = { current_password: string; new_password: string; confirm_password: string };

export function passwordErrors(values: PasswordValues): Partial<Record<keyof PasswordValues, string>> {
  const errors: Partial<Record<keyof PasswordValues, string>> = {};
  if (!values.current_password) errors.current_password = "Enter your current password";
  if (!values.new_password) errors.new_password = "Enter a new password";
  else if (values.new_password.length < PASSWORD_MIN_LENGTH)
    errors.new_password = `Use at least ${PASSWORD_MIN_LENGTH} characters`;
  if (values.new_password && values.confirm_password !== values.new_password)
    errors.confirm_password = "The two passwords don't match";
  return errors;
}
