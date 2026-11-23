import { keepPreviousData, useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { Payment } from "@/types";

export interface PaymentsResponse {
  data: Payment[];
  totalCount: number;
  pageCount: number;
  /** Sum of every payment matching the filters (all pages). */
  totalAmount: number;
}

interface UsePaymentsParams {
  page?: number;
  limit?: number;
  owner_subscription_id?: string;
  member_subscription_id?: string;
  subscription_type?: string;
  /** Member name, phone (any format) or transaction ID; owner name for super admins. */
  search?: string;
  gym_id?: string;
  location_id?: string;
  /** Payment date range: from (included) and to (excluded). */
  date_from?: Date;
  date_to?: Date;
  payment_method?: "CASH" | "BANK_TRANSFER";
  enabled?: boolean;
}

export const usePayments = ({
  page,
  limit,
  owner_subscription_id,
  member_subscription_id,
  subscription_type,
  search,
  gym_id,
  location_id,
  date_from,
  date_to,
  payment_method,
  enabled = true,
}: UsePaymentsParams = {}) =>
  useQuery<PaymentsResponse, Error>({
    queryKey: [
      "payments",
      page,
      limit,
      owner_subscription_id,
      member_subscription_id,
      subscription_type,
      search,
      gym_id,
      location_id,
      date_from?.toISOString(),
      date_to?.toISOString(),
      payment_method,
    ],
    queryFn: async () => {
      const res = await axios.post<PaymentsResponse>("/api/payments/getpayments", {
        page,
        limit,
        owner_subscription_id,
        member_subscription_id,
        subscription_type,
        search: search?.trim() || undefined,
        gym_id: gym_id || undefined,
        location_id: location_id || undefined,
        date_from: date_from?.toISOString(),
        date_to: date_to?.toISOString(),
        payment_method,
      });
      return res.data;
    },
    // Keep the current list (and the search box) on screen while a new search or page loads.
    placeholderData: keepPreviousData,
    enabled,
  });
