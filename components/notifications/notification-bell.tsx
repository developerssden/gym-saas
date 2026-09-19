"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Bell } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  NotificationItem,
  type InAppNotification,
} from "@/components/notifications/notification-item";

type UnreadCountResponse = {
  unreadCount: number;
};

type NotificationsListResponse = {
  data: InAppNotification[];
  totalCount: number;
  unreadCount: number;
};

export function NotificationBell() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: unreadData } = useQuery<UnreadCountResponse>({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const res = await axios.get<UnreadCountResponse>(
        "/api/notifications/unread-count"
      );
      return res.data;
    },
    refetchInterval: 45_000,
  });

  const { data: listData, isLoading } = useQuery<NotificationsListResponse>({
    queryKey: ["notifications", "list", "dropdown"],
    queryFn: async () => {
      const res = await axios.get<NotificationsListResponse>(
        "/api/notifications/list",
        { params: { page: 1, limit: 5 } }
      );
      return res.data;
    },
    enabled: open,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.patch("/api/notifications/mark-read", { ids: [id] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unreadCount = unreadData?.unreadCount ?? 0;
  const notifications = listData?.data ?? [];

  const handleSelect = async (notification: InAppNotification) => {
    setOpen(false);
    if (!notification.read) {
      await markReadMutation.mutateAsync(notification.id);
    }
    if (notification.url) {
      router.push(notification.url);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {isLoading && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Loading...
            </p>
          )}
          {!isLoading && notifications.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No notifications yet
            </p>
          )}
          {!isLoading &&
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onSelect={handleSelect}
              />
            ))}
        </div>
        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link href="/notifications" onClick={() => setOpen(false)}>
              See all
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
