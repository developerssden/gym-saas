import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { Payment } from "@/types";

export interface PaymentsResponse {
  data: Payment[];
  totalCount: number;
  pageCount: number;
}

interface UsePaymentsParams {
  page?: number;
  limit?: number;
  owner_subscription_id?: string;
  member_subscription_id?: string;
  subscription_type?: string;
  enabled?: boolean;
}

export const usePayments = ({
  page,
  limit,
  owner_subscription_id,
  member_subscription_id,
  subscription_type,
  enabled = true,
}: UsePaymentsParams = {}) =>
  useQuery<PaymentsResponse, Error>({
    queryKey: ["payments", page, limit, owner_subscription_id, member_subscription_id, subscription_type],
    queryFn: async () => {
      const res = await axios.post<PaymentsResponse>("/api/payments/getpayments", {
        page,
        limit,
        owner_subscription_id,
        member_subscription_id,
        subscription_type,
      });
      return res.data;
    },
    enabled,
  });

