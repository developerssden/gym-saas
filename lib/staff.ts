import prisma from "@/lib/prisma";
import { buildStaffInviteUrl, sendStaffInviteEmail } from "@/lib/invite-email";
import { generateToken, getTokenExpiry, hashToken } from "@/lib/tokens";

/** Fields of a staff account that are safe to send to the owner's browser. */
export const STAFF_SELECT = {
  id: true,
  email: true,
  first_name: true,
  last_name: true,
  phone_number: true,
  is_active: true,
  onboarding_completed: true,
  staff_gym_id: true,
  staff_permissions: true,
  createdAt: true,
  staff_gym: { select: { id: true, name: true } },
} as const;

export type StaffStatus = "active" | "invited" | "deactivated";

export function staffStatus(user: { is_active: boolean; onboarding_completed: boolean }): StaffStatus {
  if (!user.onboarding_completed) return "invited";
  return user.is_active ? "active" : "deactivated";
}

/** Loads a staff account only if it works for this owner. */
export function findOwnedStaff(ownerId: string, id: string) {
  return prisma.user.findFirst({
    where: { id, role: "STAFF", staff_owner_id: ownerId, is_deleted: false },
    select: STAFF_SELECT,
  });
}

/**
 * Creates a fresh invite token for a staff account (retiring any unused ones)
 * and emails the link.
 */
export async function sendStaffInvite(
  staff: { id: string; email: string },
  owner: { first_name: string | null; last_name: string | null },
  gymName: string,
  isResend = false
): Promise<void> {
  const email = staff.email.toLowerCase().trim();
  const rawToken = generateToken();

  await prisma.$transaction([
    prisma.inviteToken.updateMany({
      where: { user_id: staff.id, used: false },
      data: { used: true },
    }),
    prisma.inviteToken.create({
      data: {
        token: hashToken(rawToken),
        email,
        user_id: staff.id,
        expires_at: getTokenExpiry(),
      },
    }),
  ]);

  const ownerName = [owner.first_name, owner.last_name].filter(Boolean).join(" ") || "Your gym owner";
  await sendStaffInviteEmail(email, buildStaffInviteUrl(email, rawToken), gymName, ownerName, isResend);
}
