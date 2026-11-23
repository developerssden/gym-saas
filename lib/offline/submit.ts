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
 * time it was taken. Returns the new payment's id (for the receipt; null when
 * nothing was paid), or "queued" when it was saved for later instead.
 * Throws the server's error when the payment was refused.
 */
export type SubmitResult = { status: "saved"; paymentId: string | null } | { status: "queued" };

/**
 * The payment id from the response: a renewal sends `payment_id` (its `data` is
 * the subscription); createpayment and an already-recorded replay send the
 * payment itself as `data`.
 */
export function paymentIdFrom(body: unknown): string | null {
  const b = (body ?? {}) as { payment_id?: unknown; data?: { id?: unknown } };
  const id = "payment_id" in b ? b.payment_id : b.data?.id;
  return typeof id === "string" ? id : null;
}

export async function submitPayment(submission: PaymentSubmission): Promise<SubmitResult> {
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
    return { status: "queued" } as const;
  };

  if (typeof navigator !== "undefined" && !navigator.onLine) return queue();
  try {
    const res = await axios.post(submission.url, body);
    return { status: "saved", paymentId: paymentIdFrom(res.data) };
  } catch (err) {
    // The connection dropped: it may or may not have reached the server, and
    // the client_id makes the later resend safe either way.
    if (isOfflineError(err)) return queue();
    throw err;
  }
}
