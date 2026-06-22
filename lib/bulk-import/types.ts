export type ImportMode = "members_only" | "member_with_subscription";

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

export const TEMPLATE_HEADERS = [
  "full_name",
  "phone_number",
  "email",
  "address",
  "city",
  "state",
  "zip_code",
  "country",
  "date_of_birth",
  "cnic",
  "start_date",
  "end_date",
  "months",
  "price",
  "payment_method",
  "transaction_id",
  "payment_date",
] as const;

export const TEMPLATE_EXAMPLE_ROW: Record<string, string | number> = {
  full_name: "Ali Khan",
  phone_number: "+923001234567",
  email: "ali@example.com",
  address: "123 Main St",
  city: "Lahore",
  state: "Punjab",
  zip_code: "54000",
  country: "Pakistan",
  date_of_birth: "1995-06-15",
  cnic: "",
  start_date: "2026-01-01",
  end_date: "2026-07-01",
  months: "",
  price: 5000,
  payment_method: "CASH",
  transaction_id: "",
  payment_date: "2026-01-01",
};

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
  | { row: number; status: "error"; name: string; error: string };

export type BulkImportResponse = {
  total: number;
  succeeded: number;
  failed: number;
  results: ImportRowResult[];
};
