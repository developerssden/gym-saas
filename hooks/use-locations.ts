import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { Location } from "@/types";

export interface LocationsResponse {
  data: Location[];
  totalCount: number;
  pageCount: number;
}

interface UseLocationsParams {
  page?: number;
  limit?: number;
  search?: string;
  gym_id?: string;
  enabled?: boolean;
}

export const useLocations = ({ page, limit, search, gym_id, enabled = true }: UseLocationsParams = {}) =>
  useQuery<LocationsResponse, Error>({
    queryKey: ["locations", page, limit, search, gym_id],
    queryFn: async () => {
      const res = await axios.post<LocationsResponse>("/api/locations/getlocations", {
        page,
        limit,
        search,
        gym_id,
      });
      return res.data;
    },
    enabled,
  });


