import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { OwnerSubscription } from "@/types";

export interface OwnerSubscriptionsResponse {
  data: OwnerSubscription[];
  totalCount: number;
  pageCount: number;
}

interface UseOwnerSubscriptionsParams {
  page?: number;
  limit?: number;
  search?: string;
  owner_id?: string;
  enabled?: boolean;
}

export const useOwnerSubscriptions = (
  { page, limit, search, owner_id, enabled = true }: UseOwnerSubscriptionsParams = {}
) =>
  useQuery<OwnerSubscriptionsResponse, Error>({
    queryKey: ["ownerSubscriptions", page, limit, search, owner_id],
    queryFn: async () => {
      const res = await axios.post<OwnerSubscriptionsResponse>(
        "/api/subscription/getsubscriptions",
        {
          page,
          limit,
          search,
          owner_id,
        }
      );
      return res.data;
    },
    enabled,
  });


