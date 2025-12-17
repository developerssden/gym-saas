import { BillingModel } from "@/prisma/generated/client";

/**
 * Calculate end date based on billing model
 */
export function calculateEndDate(
  startDate: Date,
  billingModel: BillingModel
): Date {
  const endDate = new Date(startDate);
  
  if (billingModel === "MONTHLY") {
    endDate.setMonth(endDate.getMonth() + 1);
  } else if (billingModel === "YEARLY") {
    endDate.setFullYear(endDate.getFullYear() + 1);
  }
  
  return endDate;
}

/**
 * Calculate next payment date (same as end date for renewal)
 */
export function calculateNextPaymentDate(
  endDate: Date
): Date {
  return new Date(endDate);
}

/**
 * Check if a subscription is expired
 */
export function isSubscriptionExpired(endDate: Date): boolean {
  return new Date() > endDate;
}

/**
 * Calculate remaining days in current subscription
 */
export function getRemainingDays(endDate: Date): number {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Get subscription price based on billing model
 */
export function getSubscriptionPrice(
  monthlyPrice: number,
  yearlyPrice: number,
  billingModel: BillingModel
): number {
  return billingModel === "MONTHLY" ? monthlyPrice : yearlyPrice;
}

/**
 * Deactivate all active subscriptions for an owner
 */
export async function deactivateOwnerSubscriptions(
  prisma: any,
  ownerId: string
) {
  await prisma.ownerSubscription.updateMany({
    where: {
      owner_id: ownerId,
      is_active: true,
      is_deleted: false,
    },
    data: {
      is_active: false,
      updatedAt: new Date(),
    },
  });
}

/**
 * Check and update expired subscriptions
 */
export async function updateExpiredSubscriptions(prisma: any) {
  const now = new Date();
  
  await prisma.ownerSubscription.updateMany({
    where: {
      end_date: {
        lt: now,
      },
      is_expired: false,
      is_deleted: false,
    },
    data: {
      is_expired: true,
      is_active: false,
      updatedAt: now,
    },
  });
}

/**
 * Get plan price based on billing model
 */
export function getPlanPrice(
  plan: { monthly_price: number; yearly_price: number },
  billingModel: BillingModel
): number {
  return billingModel === "MONTHLY" ? plan.monthly_price : plan.yearly_price;
}

/**
 * Calculate end date with remaining days from previous subscription added
 */
export function calculateEndDateWithRemainingDays(
  startDate: Date,
  billingModel: BillingModel,
  remainingDays: number
): Date {
  const endDate = calculateEndDate(startDate, billingModel);
  
  // Add remaining days to the end date
  if (remainingDays > 0) {
    endDate.setDate(endDate.getDate() + remainingDays);
  }
  
  return endDate;
}

/**
 * Calculate remaining days from a subscription end date
 * Returns 0 if expired or negative
 */
export function calculateRemainingDaysFromEndDate(endDate: Date): number {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
}

