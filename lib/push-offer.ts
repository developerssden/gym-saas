// Ask to turn on notifications at a moment where they make sense: right after
// the owner adds members (fee reminders are about members), once per browser,
// and only if the browser hasn't been asked yet.
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { enablePushNotifications, pushSupported } from "@/lib/push-client";

const OFFERED_KEY = "kettlio:push-offered";

export function offerPushNotifications(): void {
  if (!pushSupported() || Notification.permission !== "default") return;
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;
  try {
    if (localStorage.getItem(OFFERED_KEY)) return;
    localStorage.setItem(OFFERED_KEY, "1");
  } catch {
    return;
  }
  // The browser permission prompt must come from a tap, so ask with a button.
  toast("Get a reminder when members' fees are due?", {
    description: "Turn on notifications on this device.",
    duration: 15000,
    action: {
      label: "Turn on",
      onClick: () => {
        enablePushNotifications()
          .then(() => toast.success("Notifications turned on"))
          .catch(err => toast.error(getErrorMessage(err)));
      },
    },
  });
}
