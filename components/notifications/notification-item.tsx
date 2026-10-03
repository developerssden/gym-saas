"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import axios from "axios";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { isExpiredMembersNotice } from "@/lib/notifications/expired-members-notice";

export type InAppNotification = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  type: string;
  read: boolean;
  createdAt: string;
};

function filenameFrom(disposition: string | undefined, fallback: string) {
  const match = disposition?.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

export function NotificationItem({
  notification,
  onSelect,
}: {
  notification: InAppNotification;
  onSelect: (notification: InAppNotification) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const canDownload = isExpiredMembersNotice(notification);

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
      link.download = filenameFrom(
        res.headers["content-disposition"],
        "expired-members.pdf"
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
        !notification.read && "bg-[#BDDE63]/10"
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(notification)}
        className="w-full px-3 pt-2 text-left last:pb-2"
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
      {canDownload && (
        <div className="px-3 pt-1 pb-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
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
