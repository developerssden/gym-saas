// "Install the app" support. Chrome/Edge/Android fire `beforeinstallprompt`
// once, early, so it's captured at module load and kept for later. iPhone
// Safari has no prompt: owners use Share > Add to Home Screen.

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const INSTALLED_KEY = "kettlio:app-installed";
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

const remember = (value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(INSTALLED_KEY);
    else localStorage.setItem(INSTALLED_KEY, value);
  } catch {
    // Storage can be blocked; installs are still detected while running standalone.
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    remember("1");
    notify();
  });
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Running as the installed app, or installed from this browser before. */
export function isAppInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return true;
  try {
    return localStorage.getItem(INSTALLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function canPromptInstall(): boolean {
  return deferred !== null;
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Shows the browser's install dialog. Resolves true when the owner accepts. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") remember("1");
  notify();
  return outcome === "accepted";
}
