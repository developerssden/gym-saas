"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/getErrorMessage";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function getReadyServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.ready;
}

export default function PushNotificationToggle() {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState(false);
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  const refreshState = useCallback(async () => {
    if (
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setSupported(false);
      setEnabled(false);
      return;
    }

    const registration = await getReadyServiceWorker();
    const existing = await registration?.pushManager.getSubscription();
    setEnabled(Boolean(existing) && Notification.permission === "granted");
  }, []);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  const enableNotifications = async () => {
    if (!vapidPublicKey) {
      toast.error("Push notifications are not configured on this server.");
      return;
    }

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission was denied.");
        setEnabled(false);
        return;
      }

      const registration = await getReadyServiceWorker();
      if (!registration) {
        toast.error("Service worker is not ready yet. Build and open the installed app, then try again.");
        return;
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      const json = subscription.toJSON();
      await axios.post("/api/push/subscribe", {
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        },
      });

      setEnabled(true);
      toast.success("Push notifications enabled");
    } catch (error) {
      toast.error(getErrorMessage(error));
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  };

  const disableNotifications = async () => {
    setBusy(true);
    try {
      const registration = await getReadyServiceWorker();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await axios.delete("/api/push/subscribe", {
          data: { endpoint: subscription.endpoint },
        });
        await subscription.unsubscribe();
      }
      setEnabled(false);
      toast.success("Push notifications disabled");
    } catch (error) {
      toast.error(getErrorMessage(error));
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
          void (checked ? enableNotifications() : disableNotifications());
        }}
      />
    </div>
  );
}
