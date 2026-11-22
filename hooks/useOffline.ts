"use client";

import { useSyncExternalStore } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { getOutboxSnapshot, getServerOutboxSnapshot, subscribeOutbox } from "@/lib/offline/outbox";
import type { DirectoryMember } from "@/lib/offline/outbox-types";

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

/** This user's payments waiting on this device (pending and failed). */
export function useOutbox() {
  const { data: session } = useSession();
  const all = useSyncExternalStore(subscribeOutbox, getOutboxSnapshot, getServerOutboxSnapshot);
  const userId = session?.user?.id;
  return userId ? all.filter(i => i.userId === userId) : [];
}

/**
 * Members of the selected gym/location with what they owe, kept on the device
 * (the query cache is saved to IndexedDB) for recording fees offline.
 */
export function useMemberDirectory(enabled = true) {
  const { data: session } = useSession();
  const gymId = session?.user?.selected_gym_id || undefined;
  const locationId = session?.user?.selected_location_id || undefined;
  return useQuery({
    queryKey: ["offline-directory", gymId, locationId],
    queryFn: async () =>
      (
        await axios.post<{ data: DirectoryMember[]; savedAt: string }>("/api/payments/offline-directory", {
          gym_id: gymId,
          location_id: locationId,
        })
      ).data,
    enabled: enabled && !!session?.user,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
