"use client";

import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export type InAppNotification = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  type: string;
  read: boolean;
  createdAt: string;
};

export function NotificationItem({
  notification,
  onSelect,
}: {
  notification: InAppNotification;
  onSelect: (notification: InAppNotification) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(notification)}
      className={cn(
        "w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-accent/60",
        !notification.read && "bg-[#BDDE63]/10"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-5">{notification.title}</p>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.createdAt), {
            addSuffix: true,
          })}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {notification.body}
      </p>
    </button>
  );
}
