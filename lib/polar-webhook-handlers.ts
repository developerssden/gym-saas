import prisma from "@/lib/prisma";
import { deactivateOwnerSubscriptions } from "@/lib/subscription-helpers";
import {
  BillingModel,
  PaymentMethod,
  SubscriptionTypeEnum,
} from "@/prisma/generated/client";
import type { Order } from "@polar-sh/sdk/models/components/order";
import type { Subscription } from "@polar-sh/sdk/models/components/subscription";

function billingModelFromInterval(
  interval: Subscription["recurringInterval"]
): BillingModel {
  return interval === "year" ? "YEARLY" : "MONTHLY";
}

function subscriptionActiveState(status: Subscription["status"]) {
  const isExpired = status === "canceled" || status === "unpaid";
  const isActive = status === "active" || status === "trialing";
  return { isActive, isExpired };
}

async function findGymOwnerByEmail(email: string | null | undefined) {
  if (!email) return null;

  return prisma.user.findFirst({
    where: {
      email,
      role: "GYM_OWNER",
      is_deleted: false,
    },
  });
}

export async function handlePolarSubscriptionCreated(subscription: Subscription) {
  const existing = await prisma.ownerSubscription.findUnique({
    where: { polar_subscription_id: subscription.id },
  });

  if (existing) {
    const { isActive, isExpired } = subscriptionActiveState(subscription.status);
    await prisma.ownerSubscription.update({
      where: { id: existing.id },
      data: {
        end_date: subscription.currentPeriodEnd,
        is_active: isActive,
        is_expired: isExpired,
      },
    });
    return;
  }

  const plan = await prisma.plan.findUnique({
    where: { polar_product_id: subscription.productId },
  });
  if (!plan) {
    console.error(`No plan found for polar product_id: ${subscription.productId}`);
    return;
  }

  const user = await findGymOwnerByEmail(subscription.customer.email);
  if (!user) {
    console.error(`No GYM_OWNER found for email: ${subscription.customer.email}`);
    return;
  }

  const billingModel = billingModelFromInterval(subscription.recurringInterval);
  const { isActive, isExpired } = subscriptionActiveState(subscription.status);

  await prisma.$transaction(async (tx) => {
    await deactivateOwnerSubscriptions(tx, user.id);

    await tx.ownerSubscription.create({
      data: {
        owner_id: user.id,
        plan_id: plan.id,
        billing_model: billingModel,
        start_date: subscription.currentPeriodStart,
        end_date: subscription.currentPeriodEnd,
        is_active: isActive,
        is_expired: isExpired,
        polar_subscription_id: subscription.id,
      },
    });
  });

  console.log(`OwnerSubscription created for user ${user.id}`);
}

export async function handlePolarSubscriptionUpdated(subscription: Subscription) {
  const ownerSub = await prisma.ownerSubscription.findUnique({
    where: { polar_subscription_id: subscription.id },
  });

  if (!ownerSub) {
    console.error(`No OwnerSubscription found for polar_subscription_id: ${subscription.id}`);
    return;
  }

  const { isActive, isExpired } = subscriptionActiveState(subscription.status);

  await prisma.ownerSubscription.update({
    where: { id: ownerSub.id },
    data: {
      end_date: subscription.currentPeriodEnd,
      is_active: isActive,
      is_expired: isExpired,
    },
  });
}

export async function handlePolarSubscriptionCanceled(subscription: Subscription) {
  const ownerSub = await prisma.ownerSubscription.findUnique({
    where: { polar_subscription_id: subscription.id },
  });

  if (!ownerSub) {
    console.error(`No OwnerSubscription found for polar_subscription_id: ${subscription.id}`);
    return;
  }

  await prisma.ownerSubscription.update({
    where: { id: ownerSub.id },
    data: {
      is_active: false,
      is_expired: true,
    },
  });
}

export async function handlePolarOrderPaid(order: Order) {
  if (!order.paid) return;

  const existingPayment = await prisma.payment.findFirst({
    where: { transaction_id: order.id },
  });
  if (existingPayment) return;

  let ownerSub = order.subscriptionId
    ? await prisma.ownerSubscription.findUnique({
        where: { polar_subscription_id: order.subscriptionId },
      })
    : null;

  if (!ownerSub) {
    const user = await findGymOwnerByEmail(order.customer.email);
    if (!user) {
      console.error(`No GYM_OWNER found for email: ${order.customer.email}`);
      return;
    }

    ownerSub = await prisma.ownerSubscription.findFirst({
      where: {
        owner_id: user.id,
        is_active: true,
        is_deleted: false,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!ownerSub) {
    console.error(`No OwnerSubscription found for order ${order.id}`);
    return;
  }

  const user = await findGymOwnerByEmail(order.customer.email);

  await prisma.payment.create({
    data: {
      owner_subscription_id: ownerSub.id,
      subscription_type: SubscriptionTypeEnum.OWNER,
      amount: Math.round(order.totalAmount / 100),
      payment_method: PaymentMethod.BANK_TRANSFER,
      payment_date: order.createdAt,
      transaction_id: order.id,
      notes: `Polar order ${order.id}`,
      recorded_by_id: user?.id ?? null,
    },
  });
}
