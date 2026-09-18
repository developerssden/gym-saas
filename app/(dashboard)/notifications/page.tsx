"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ChevronLeft, ChevronRight } from "lucide-react";

import FullScreenLoader from "@/components/common/FullScreenLoader";
import DataFetchError from "@/components/common/DataFetchError";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import {
  NotificationItem,
  type InAppNotification,
} from "@/components/notifications/notification-item";

type NotificationsListResponse = {
  data: InAppNotification[];
  totalCount: number;
  unreadCount: number;
  page: number;
  limit: number;
  pageCount: number;
};

const PAGE_SIZE = 20;

const NotificationsPage = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status } = useSession({ required: true });
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery<NotificationsListResponse>({
    queryKey: ["notifications", "list", page, PAGE_SIZE],
    queryFn: async () => {
      const res = await axios.get<NotificationsListResponse>(
        "/api/notifications/list",
        { params: { page, limit: PAGE_SIZE } }
      );
      return res.data;
    },
    enabled: status === "authenticated",
  });

  const markReadMutation = useMutation({
    mutationFn: async (payload: { ids?: string[]; all?: boolean }) => {
      await axios.patch("/api/notifications/mark-read", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleSelect = async (notification: InAppNotification) => {
    if (!notification.read) {
      await markReadMutation.mutateAsync({ ids: [notification.id] });
    }
    if (notification.url) {
      router.push(notification.url);
    }
  };

  if (status === "loading") {
    return <FullScreenLoader />;
  }

  const notifications = data?.data ?? [];
  const pageCount = data?.pageCount ?? 1;
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="h1">Notifications</h1>
        <Button
          variant="outline"
          disabled={unreadCount === 0 || markReadMutation.isPending}
          onClick={() => markReadMutation.mutate({ all: true })}
        >
          Mark all as read
        </Button>
      </div>

      {isLoading && !data && (
        <div className="flex h-64 items-center justify-center">
          <FullScreenLoader label="Loading notifications..." />
        </div>
      )}

      {error && (
        <DataFetchError
          error={error}
          onRetry={() => refetch()}
          message="Error loading notifications"
        />
      )}

      {data && notifications.length === 0 && (
        <p className="text-sm text-muted-foreground">No notifications yet.</p>
      )}

      {data && notifications.length > 0 && (
        <div className="space-y-1">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}

      {data && pageCount > 1 && (
        <div className="mt-4 flex items-center justify-end space-x-2">
          <p className="mr-2 text-sm font-medium">
            Page {page} of {pageCount}
          </p>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            disabled={page >= pageCount}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRight />
          </Button>
        </div>
      )}
    </PageContainer>
  );
};

export default NotificationsPage;
