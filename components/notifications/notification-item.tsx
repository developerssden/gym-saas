"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import axios from "axios";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { isExpiredMembersNotice } from "@/lib/notifications/expired-members-notice";
import { filenameFromDisposition } from "@/lib/download-filename";

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
  time = "relative",
}: {
  notification: InAppNotification;
  onSelect: (notification: InAppNotification) => void;
  /** "relative" (3 hours ago) in the bell; "clock" (2:05 PM) under a day heading. */
  time?: "relative" | "clock";
}) {
  const [downloading, setDownloading] = useState(false);
  const canDownload = isExpiredMembersNotice(notification);
  const created = new Date(notification.createdAt);

  const handleDownload = async () => {
    if (!notification.url) return;
    setDownloading(true);
    try {
      const res = await axios.get<Blob>(notification.url, {
        responseType: "blob",
      });
      const href = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = href;
      link.download = filenameFromDisposition(
        res.headers["content-disposition"],
        "Expired Members.pdf"
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch {
      toast.error("Could not download the expired members PDF.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-md transition-colors hover:bg-accent/60",
        !notification.read && "bg-primary/10"
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(notification)}
        className="min-h-11 w-full px-3 pt-2 text-left last:pb-2"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-start gap-2 text-sm font-medium leading-5">
            {!notification.read && (
              <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-primary-dim" />
            )}
            <span>
              {!notification.read && <span className="sr-only">Unread: </span>}
              {notification.title}
            </span>
          </p>
          <time dateTime={notification.createdAt} className="shrink-0 text-xs text-muted-foreground">
            {time === "clock"
              ? format(created, "h:mm a")
              : formatDistanceToNow(created, { addSuffix: true })}
          </time>
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {notification.body}
        </p>
      </button>
      {canDownload && (
        <div className="px-3 pt-1 pb-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 text-xs md:h-8"
            disabled={downloading}
            onClick={handleDownload}
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Download PDF
          </Button>
        </div>
      )}
    </div>
  );
}
