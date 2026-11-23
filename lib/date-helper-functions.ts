import { formatDate as formatDisplayDate } from "@/lib/format"
export const toDate = (value?: string) =>
    value ? new Date(value) : undefined;
  
export const formatDate = (value?: string | Date) =>
    value ? formatDisplayDate(value, "Select date") : "Select date";
  