import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import { buildInviteUrl, sendInviteEmail } from "@/lib/invite-email";
import prisma from "@/lib/prisma";
import { generateToken, getTokenExpiry, hashToken } from "@/lib/tokens";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

  const { id } = req.body;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ message: "Client ID is required" });
  }

  const user = await prisma.user.findFirst({
    where: {
      id,
      is_deleted: false,
      role: "GYM_OWNER",
      is_active: false,
      onboarding_completed: false,
    },
  });

  if (!user?.email) {
    return res.status(404).json({
      message: "No pending invite found for this client. Only incomplete invites can be resent.",
    });
  }

  const normalizedEmail = user.email.toLowerCase().trim();
  const rawToken = generateToken();
  const hashedToken = hashToken(rawToken);

  await prisma.$transaction([
    prisma.inviteToken.updateMany({
      where: { user_id: user.id, used: false },
      data: { used: true },
    }),
    prisma.inviteToken.create({
      data: {
        token: hashedToken,
        email: normalizedEmail,
        user_id: user.id,
        expires_at: getTokenExpiry(),
      },
    }),
  ]);

  const inviteUrl = buildInviteUrl(normalizedEmail, rawToken);
  await sendInviteEmail(normalizedEmail, inviteUrl, true);

  return res.status(200).json({ message: "Invite resent successfully" });
}
