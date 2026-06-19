import type { NextApiRequest, NextApiResponse } from "next";
import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import {
  handlePolarOrderPaid,
  handlePolarSubscriptionCanceled,
  handlePolarSubscriptionCreated,
  handlePolarSubscriptionUpdated,
} from "@/lib/polar-webhook-handlers";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req: NextApiRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (!webhookSecret) {
    console.error("POLAR_WEBHOOK_SECRET is not configured");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  const rawBody = await readRawBody(req);
  const webhookHeaders = {
    "webhook-id": (req.headers["webhook-id"] as string) ?? "",
    "webhook-timestamp": (req.headers["webhook-timestamp"] as string) ?? "",
    "webhook-signature": (req.headers["webhook-signature"] as string) ?? "",
  };

  try {
    const payload = validateEvent(rawBody, webhookHeaders, webhookSecret);

    switch (payload.type) {
      case "subscription.created":
        await handlePolarSubscriptionCreated(payload.data);
        break;
      case "subscription.updated":
        await handlePolarSubscriptionUpdated(payload.data);
        break;
      case "subscription.canceled":
        await handlePolarSubscriptionCanceled(payload.data);
        break;
      case "subscription.revoked":
        await handlePolarSubscriptionCanceled(payload.data);
        break;
      case "order.created":
      case "order.paid":
        await handlePolarOrderPaid(payload.data);
        break;
      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return res.status(403).json({ received: false });
    }
    console.error("Polar webhook error:", error);
    return res.status(500).json({ error: "Webhook handler failed" });
  }
}
