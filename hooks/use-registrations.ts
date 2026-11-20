import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import type { GymRegistration } from "@/types";

export interface RegistrationsResponse {
  data: GymRegistration[];
  totalCount: number;
  pageCount: number;
}

interface UseRegistrationsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  enabled?: boolean;
}

export const useRegistrations = (
  { page, limit, search, status, enabled = true }: UseRegistrationsParams = {}
) =>
  useQuery<RegistrationsResponse, Error>({
    queryKey: ["registrations", page, limit, search, status],
    queryFn: async () => {
      const res = await axios.post<RegistrationsResponse>("/api/registrations/getregistrations", {
        page,
        limit,
        search,
        status,
      });
      return res.data;
    },
    enabled,
  });

export const useUpdateRegistration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status?: GymRegistration["status"]; admin_note?: string | null }) =>
      axios.post("/api/registrations/updateregistration", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
    },
  });
};
