import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import { buildInviteUrl, sendInviteEmail } from "@/lib/invite-email";
import prisma from "@/lib/prisma";
import { generateToken, hashToken, getTokenExpiry } from "@/lib/tokens";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ message: "Email is required" });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findFirst({
    where: { email: normalizedEmail, is_deleted: false },
  });

  if (existing) {
    return res.status(409).json({ message: "A user with this email already exists" });
  }

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      role: "GYM_OWNER",
      is_active: false,
      onboarding_completed: false,
    },
  });

  const rawToken = generateToken();
  const hashedToken = hashToken(rawToken);

  await prisma.inviteToken.create({
    data: {
      token: hashedToken,
      email: normalizedEmail,
      user_id: user.id,
      expires_at: getTokenExpiry(),
    },
  });

  const inviteUrl = buildInviteUrl(normalizedEmail, rawToken);
  await sendInviteEmail(normalizedEmail, inviteUrl);

  return res.status(200).json({ message: "Invite sent successfully" });
}
