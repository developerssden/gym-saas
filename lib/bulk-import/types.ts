export type ImportMode = "members_only" | "member_with_subscription";

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

export type ParsedImportRow = {
  rowNumber: number;
  full_name: string;
  phone_number: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  date_of_birth: string;
  cnic: string;
  start_date: string;
  end_date: string;
  months: string;
  price: string;
  payment_method: string;
  transaction_id: string;
  payment_date: string;
};

export type ValidatedImportRow = {
  rowNumber: number;
  first_name: string;
  last_name: string;
  phone_number: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  date_of_birth: Date | null;
  cnic: string | null;
  start_date?: Date;
  end_date?: Date;
  months?: number;
  price?: number;
  payment_method?: "CASH" | "BANK_TRANSFER";
  transaction_id?: string | null;
  payment_date?: Date;
};

export type ImportRowResult =
  | { row: number; status: "success"; member_id: string; name: string }
  /** Checked and can be added (check-only run). */
  | { row: number; status: "ready"; name: string }
  | { row: number; status: "error"; name: string; error: string };

export type BulkImportResponse = {
  total: number;
  succeeded: number;
  failed: number;
  results: ImportRowResult[];
};

/** The check before importing: nothing is saved. */
export type BulkImportCheckResponse = {
  total: number;
  ready: number;
  failed: number;
  /** Members this branch can still take on the current plan. */
  slotsLeft: number;
  results: ImportRowResult[];
};
