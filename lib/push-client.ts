// Browser side of web push: shared by the profile toggle, the setup checklist
// and the prompt shown after an owner adds their first member.
import axios from "axios";

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

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/** True when this browser is subscribed and allowed to show notifications. */
export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false;
  const registration = await getReadyServiceWorker();
  const existing = await registration?.pushManager.getSubscription();
  return Boolean(existing) && Notification.permission === "granted";
}

/** Asks for permission and saves the subscription. Throws a user-facing Error on failure. */
export async function enablePushNotifications(): Promise<void> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) throw new Error("Push notifications are not configured on this server.");
  if (!pushSupported()) throw new Error("Push notifications are not supported in this browser.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was denied.");

  const registration = await getReadyServiceWorker();
  if (!registration) {
    throw new Error("Service worker is not ready yet. Build and open the installed app, then try again.");
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
    keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
  });
}

export async function disablePushNotifications(): Promise<void> {
  const registration = await getReadyServiceWorker();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await axios.delete("/api/push/subscribe", { data: { endpoint: subscription.endpoint } });
    await subscription.unsubscribe();
  }
}
