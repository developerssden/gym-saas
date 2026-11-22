"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/getErrorMessage";
import {
  disablePushNotifications,
  enablePushNotifications,
  isPushEnabled,
  pushSupported,
} from "@/lib/push-client";

export default function PushNotificationToggle() {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState(false);

  const refreshState = useCallback(async () => {
    if (!pushSupported()) {
      setSupported(false);
      setEnabled(false);
      return;
    }
    setEnabled(await isPushEnabled());
  }, []);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  const toggle = async (checked: boolean) => {
    setBusy(true);
    try {
      if (checked) {
        await enablePushNotifications();
        setEnabled(true);
        toast.success("Push notifications enabled");
      } else {
        await disablePushNotifications();
        setEnabled(false);
        toast.success("Push notifications disabled");
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
      if (checked) setEnabled(false);
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        Push notifications are not supported in this browser.
      </p>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="space-y-1">
        <Label htmlFor="push-notifications">Enable notifications</Label>
        <p className="text-sm text-muted-foreground">
          Get reminders when subscriptions are about to expire.
        </p>
      </div>
      <Switch
        id="push-notifications"
        checked={enabled}
        disabled={busy}
        onCheckedChange={(checked) => {
          void toggle(checked);
        }}
      />
    </div>
  );
}
