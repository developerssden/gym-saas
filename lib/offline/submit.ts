"use client";

// Record a payment now, or keep it on this device when there's no connection.
import axios from "axios";
import { addToOutbox } from "@/lib/offline/outbox";
import { isOfflineError, newClientId } from "@/lib/offline/sync";
import type { OutboxItem } from "@/lib/offline/outbox-types";

export type PaymentSubmission = Pick<
  OutboxItem,
  "kind" | "url" | "body" | "userId" | "memberId" | "memberName" | "subscriptionId" | "amount" | "method"
>;

/**
 * Sends the payment with a client_id (so retries never duplicate it) and the
 * time it was taken. Returns "queued" when it was saved for later instead.
 * Throws the server's error when the payment was refused.
 */
export async function submitPayment(submission: PaymentSubmission): Promise<"saved" | "queued"> {
  const id = newClientId();
  const body = { ...submission.body, client_id: id, recorded_at: new Date().toISOString() };
  const queue = async () => {
    await addToOutbox({
      ...submission,
      id,
      body,
      createdAt: new Date().toISOString(),
      status: "pending",
      attempts: 0,
    });
    return "queued" as const;
  };

  if (typeof navigator !== "undefined" && !navigator.onLine) return queue();
  try {
    await axios.post(submission.url, body);
    return "saved";
  } catch (err) {
    // The connection dropped: it may or may not have reached the server, and
    // the client_id makes the later resend safe either way.
    if (isOfflineError(err)) return queue();
    throw err;
  }
}
