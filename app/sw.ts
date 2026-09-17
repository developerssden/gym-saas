/// <reference lib="webworker" />
import { PAGES_CACHE_NAME, defaultCache } from "@serwist/next/worker";
import type { HTTPMethod, PrecacheEntry, RuntimeCaching, SerwistGlobalConfig, SerwistPlugin } from "serwist";
import { ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#BDDE63" />
    <title>You're offline | Gym SaaS</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 1.5rem;
        text-align: center;
        background: #FBFBF9;
        color: #0a0a0a;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      }
      h1 { margin: 0; font-size: 1.5rem; font-weight: 600; line-height: 2rem; }
      p { margin: 0; max-width: 28rem; font-size: 0.875rem; line-height: 1.25rem; color: #737373; }
      button {
        margin-top: 0.5rem;
        padding: 0.5rem 1rem;
        border: 0;
        border-radius: 0.5rem;
        background: #BDDE63;
        color: #0a0a0a;
        font: inherit;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <h1>You&rsquo;re offline</h1>
    <p>
      Some features may be unavailable until you reconnect. Previously loaded
      dashboard data may still be available from cache.
    </p>
    <button type="button" onclick="location.reload()">Try again</button>
    <script>
      window.addEventListener("online", function () { location.reload(); });
    </script>
  </body>
</html>`;

const offlineDocumentPlugin: SerwistPlugin = {
  handlerDidError: async () =>
    new Response(OFFLINE_HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 200,
    }),
};

const offlineApiPlugin: SerwistPlugin = {
  handlerDidError: async () =>
    new Response(JSON.stringify({ error: "offline" }), {
      headers: { "Content-Type": "application/json" },
      status: 503,
    }),
};

const API_METHODS: HTTPMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const offlineFallbackCache: RuntimeCaching[] = [
  {
    matcher: ({ request, sameOrigin }) => sameOrigin && request.mode === "navigate",
    handler: new NetworkFirst({
      cacheName: PAGES_CACHE_NAME.html,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60,
        }),
        offlineDocumentPlugin,
      ],
    }),
  },
  ...API_METHODS.map<RuntimeCaching>((method) => ({
    method,
    matcher: ({ sameOrigin, url: { pathname } }) => sameOrigin && /^\/api\/.*/.test(pathname),
    handler: new NetworkOnly({ plugins: [offlineApiPlugin] }),
  })),
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...offlineFallbackCache, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Gym SaaS", {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url ?? "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/dashboard";
  event.waitUntil(self.clients.openWindow(url));
});
