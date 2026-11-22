"use client";

// Sends queued payments to the server, one at a time, oldest first.
import axios from "axios";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { loadOutbox, removeFromOutbox, updateOutboxItem } from "@/lib/offline/outbox";
import { classifySyncResponse, type OutboxItem } from "@/lib/offline/outbox-types";

/** The service worker answers API calls with 503 {error:"offline"} when there's no network. */
export function isOfflineError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  if (!err.response) return true;
  return err.response.status === 503 && (err.response.data as { error?: string } | undefined)?.error === "offline";
}

export function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

let running: Promise<{ synced: number; failed: number }> | null = null;

/** Syncs this user's waiting payments. Safe to call often; runs one sync at a time. */
export function syncOutbox(userId: string): Promise<{ synced: number; failed: number }> {
  if (!running) {
    running = runSync(userId).finally(() => {
      running = null;
    });
  }
  return running;
}

async function runSync(userId: string) {
  let synced = 0;
  let failed = 0;
  const queue = (await loadOutbox())
    .filter(i => i.userId === userId && i.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const item of queue) {
    const { status, message } = await send(item);
    const outcome = classifySyncResponse(status, item.attempts);
    if (outcome === "done") {
      await removeFromOutbox(item.id);
      synced++;
    } else if (outcome === "failed") {
      await updateOutboxItem(item.id, { status: "failed", error: message, attempts: item.attempts + 1 });
      failed++;
    } else {
      if (status !== null) await updateOutboxItem(item.id, { attempts: item.attempts + 1 });
      // No network or signed out: the rest would fail the same way.
      if (status === null || status === 401) break;
    }
  }
  return { synced, failed };
}

async function send(item: OutboxItem): Promise<{ status: number | null; message: string }> {
  try {
    const res = await axios.post(item.url, item.body, { validateStatus: () => true });
    if (res.status === 503 && (res.data as { error?: string })?.error === "offline") {
      return { status: null, message: "Offline" };
    }
    return { status: res.status, message: getErrorMessage({ response: res }) };
  } catch (err) {
    return isOfflineError(err) ? { status: null, message: "Offline" } : { status: 0, message: getErrorMessage(err) };
  }
}
