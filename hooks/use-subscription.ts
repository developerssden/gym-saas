import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface SubscriptionType {
    id: string
    name: string
    monthly_price: number
    yearly_price: number
    max_gyms: number
    max_members: number
    max_equipment: number
    is_active: boolean
    is_deleted: boolean
    createdAt: Date
    updatedAt: Date
}

export interface SubscriptionsResponse {
  data: SubscriptionType[];
  totalCount: number;
  pageCount: number;
}

interface UseSubscriptionsParams {
  page?: number;
  limit?: number;
  search?: string;
  enabled?: boolean;
}

export const useSubscriptions = ({ page, limit, search, enabled = true }: UseSubscriptionsParams = {}) =>
    useQuery<SubscriptionsResponse, Error>({
      queryKey: ["plans", page, limit, search],
      queryFn: async () => {
        const res = await axios.post<SubscriptionsResponse>("/api/plans/getplans", {
          page,
          limit,
          search,
        });
        return res.data;
      },
      enabled,
    });