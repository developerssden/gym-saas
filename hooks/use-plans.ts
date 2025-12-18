import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface PlanType {
    id: string
    name: string
    monthly_price: number
    yearly_price: number
    max_gyms: number
    max_locations: number
    max_members: number
    max_equipment: number
    is_active: boolean
    is_deleted: boolean
    createdAt: Date
    updatedAt: Date
}

export interface PlansResponse {
  data: PlanType[];
  totalCount: number;
  pageCount: number;
}

interface UsePlansParams {
  page?: number;
  limit?: number;
  search?: string;
  enabled?: boolean;
}

export const usePlans = ({ page, limit, search, enabled = true }: UsePlansParams = {}) =>
    useQuery<PlansResponse, Error>({
      queryKey: ["plans", page, limit, search],
      queryFn: async () => {
        const res = await axios.post<PlansResponse>("/api/plans/getplans", {
          page,
          limit,
          search,
        });
        return res.data;
      },
      enabled,
    });