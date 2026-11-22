"use client";

// Storage for payments recorded while offline (IndexedDB via idb-keyval), with
// a small in-memory copy that React components subscribe to.
import { get, set } from "idb-keyval";
import type { OutboxItem } from "@/lib/offline/outbox-types";

const KEY = "gymsaas-outbox";
const CHANNEL = "gymsaas-outbox";
const EMPTY: OutboxItem[] = [];

let items: OutboxItem[] = EMPTY;
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function emit() {
  listeners.forEach(l => l());
}

async function readStore(): Promise<OutboxItem[]> {
  try {
    return ((await get(KEY)) as OutboxItem[] | undefined) ?? [];
  } catch {
    return [];
  }
}

function ensureLoaded(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!loaded) {
    loaded = readStore().then(stored => {
      items = stored;
      emit();
    });
    // Keep tabs in step: another tab added or synced a payment.
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = () => {
        void readStore().then(stored => {
          items = stored;
          emit();
        });
      };
    }
  }
  return loaded;
}

async function write(next: OutboxItem[]) {
  items = next;
  emit();
  await set(KEY, next);
  channel?.postMessage("changed");
}

export function subscribeOutbox(listener: () => void): () => void {
  listeners.add(listener);
  void ensureLoaded();
  return () => listeners.delete(listener);
}

export function getOutboxSnapshot(): OutboxItem[] {
  return items;
}

export function getServerOutboxSnapshot(): OutboxItem[] {
  return EMPTY;
}

export async function addToOutbox(item: OutboxItem): Promise<void> {
  await ensureLoaded();
  await write([...items.filter(i => i.id !== item.id), item]);
}

export async function updateOutboxItem(id: string, patch: Partial<OutboxItem>): Promise<void> {
  await ensureLoaded();
  await write(items.map(i => (i.id === id ? { ...i, ...patch } : i)));
}

export async function removeFromOutbox(id: string): Promise<void> {
  await ensureLoaded();
  await write(items.filter(i => i.id !== id));
}

export async function loadOutbox(): Promise<OutboxItem[]> {
  await ensureLoaded();
  return items;
}
