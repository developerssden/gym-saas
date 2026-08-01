export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#FBFBF9] px-6 text-center">
      <h1 className="text-2xl font-semibold text-foreground">You&apos;re offline</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Some features may be unavailable until you reconnect. Previously loaded
        dashboard data may still be available from cache.
      </p>
    </main>
  );
}
