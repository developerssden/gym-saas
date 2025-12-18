import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { Gym } from "@/types";

export interface GymsResponse {
  data: Gym[];
  totalCount: number;
  pageCount: number;
}

interface UseGymsParams {
  page?: number;
  limit?: number;
  search?: string;
  owner_id?: string;
  enabled?: boolean;
}

export const useGyms = ({ page, limit, search, owner_id, enabled = true }: UseGymsParams = {}) =>
  useQuery<GymsResponse, Error>({
    queryKey: ["gyms", page, limit, search, owner_id],
    queryFn: async () => {
      const res = await axios.post<GymsResponse>("/api/gyms/getgyms", {
        page,
        limit,
        search,
        owner_id,
      });
      return res.data;
    },
    enabled,
  });


