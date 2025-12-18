import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { Announcement } from "@/types";

export interface AnnouncementsResponse {
  data: Announcement[];
  totalCount: number;
  pageCount: number;
}

interface UseAnnouncementsParams {
  page?: number;
  limit?: number;
  search?: string;
  audience?: string;
  enabled?: boolean;
}

export const useAnnouncements = (
  { page, limit, search, audience, enabled = true }: UseAnnouncementsParams = {}
) =>
  useQuery<AnnouncementsResponse, Error>({
    queryKey: ["announcements", page, limit, search, audience],
    queryFn: async () => {
      const res = await axios.post<AnnouncementsResponse>("/api/announcements/getannouncements", {
        page,
        limit,
        search,
        audience,
      });
      return res.data;
    },
    enabled,
  });


