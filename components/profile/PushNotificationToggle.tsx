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
        toast.success("Alerts turned on for this device");
      } else {
        await disablePushNotifications();
        setEnabled(false);
        toast.success("Alerts turned off for this device");
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
        This browser can&apos;t show alerts. You&apos;ll still see them under Notifications.
      </p>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="space-y-1">
        <Label htmlFor="push-notifications">Alerts on this device</Label>
        <p className="text-sm text-muted-foreground">
          A pop-up when a membership is about to end, even with the app closed.
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
