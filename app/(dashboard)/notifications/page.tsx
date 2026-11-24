"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { BellOff, CheckCheck, ChevronLeft, ChevronRight } from "lucide-react";

import DataFetchError from "@/components/common/DataFetchError";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  NotificationItem,
  type InAppNotification,
} from "@/components/notifications/notification-item";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { isExpiredMembersNotice } from "@/lib/notifications/expired-members-notice";
import { groupByDay } from "@/lib/notifications/group-by-day";

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
    placeholderData: keepPreviousData,
  });

  const markReadMutation = useMutation({
    mutationFn: async (payload: { ids?: string[]; all?: boolean }) => {
      await axios.patch("/api/notifications/mark-read", payload);
    },
    onSuccess: (_res, payload) => {
      if (payload.all) toast.success("All notifications marked as read");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const handleSelect = async (notification: InAppNotification) => {
    if (!notification.read) {
      await markReadMutation.mutateAsync({ ids: [notification.id] });
    }
    if (notification.url && !isExpiredMembersNotice(notification)) {
      router.push(notification.url);
    }
  };

  const goTo = (next: number) => {
    setPage(next);
    window.scrollTo({ top: 0 });
  };

  const notifications = data?.data ?? [];
  const pageCount = data?.pageCount ?? 1;
  const unreadCount = data?.unreadCount ?? 0;
  const groups = groupByDay(notifications);

  return (
    <PageContainer>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <PageHeader
          title="Notifications"
          description={
            data
              ? unreadCount > 0
                ? `${unreadCount} unread`
                : "You're all caught up."
              : "Reminders and alerts about your gym."
          }
          actions={
            notifications.length > 0 && (
              <Button
                variant="outline"
                className="h-11 md:h-9"
                disabled={unreadCount === 0}
                loading={markReadMutation.isPending && markReadMutation.variables?.all}
                onClick={() => markReadMutation.mutate({ all: true })}
              >
                <CheckCheck aria-hidden />
                Mark all as read
              </Button>
            )
          }
        />

        {(status === "loading" || (isLoading && !data)) && (
          <div aria-busy="true" aria-label="Loading notifications" className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {error && (
          <DataFetchError
            error={error}
            onRetry={() => refetch()}
            message="Couldn't load notifications"
          />
        )}

        {data && notifications.length === 0 && (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BellOff aria-hidden />
              </EmptyMedia>
              <EmptyTitle>No notifications yet</EmptyTitle>
              <EmptyDescription>
                You&apos;ll see fee reminders, memberships about to end and messages from Kettlio here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {groups.map(group => (
          <section key={group.key} aria-labelledby={`day-${group.key}`} className="space-y-2">
            <h2 id={`day-${group.key}`} className="px-1 text-sm font-medium text-muted-foreground">
              {group.label}
            </h2>
            <Card className="py-0">
              <CardContent className="space-y-1 p-1">
                {group.items.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onSelect={handleSelect}
                    time="clock"
                  />
                ))}
              </CardContent>
            </Card>
          </section>
        ))}

        {data && pageCount > 1 && (
          <nav aria-label="Pages" className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              className="h-11 md:h-9"
              onClick={() => goTo(Math.max(1, page - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft aria-hidden />
              Newer
            </Button>
            <p className="text-sm text-muted-foreground">
              Page {page} of {pageCount}
            </p>
            <Button
              variant="outline"
              className="h-11 md:h-9"
              onClick={() => goTo(Math.min(pageCount, page + 1))}
              disabled={page >= pageCount}
            >
              Older
              <ChevronRight aria-hidden />
            </Button>
          </nav>
        )}
      </div>
    </PageContainer>
  );
};

export default NotificationsPage;
