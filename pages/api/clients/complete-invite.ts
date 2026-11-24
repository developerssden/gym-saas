import { hashPassword } from "@/lib/authHelper";
import prisma from "@/lib/prisma";
import { hashToken } from "@/lib/tokens";
import { missingInviteFields } from "@/lib/onboarding";
import { PASSWORD_MIN_LENGTH } from "@/lib/profile";
import type { NextApiRequest, NextApiResponse } from "next";

// Accepting an invite. Owners and staff both give only a name, phone and password;
// address, date of birth and the rest can be added later in Profile.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const { token, email, password, first_name, last_name, phone_number } = (req.body ?? {}) as Record<string, unknown>;

  if (typeof token !== "string" || typeof email !== "string" || typeof password !== "string" || !token || !email) {
    return res.status(400).json({ message: "This invite link isn't valid" });
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return res.status(400).json({ message: `Use a password of at least ${PASSWORD_MIN_LENGTH} characters` });
  }
  if (missingInviteFields({ first_name, phone_number }).length > 0) {
    return res.status(400).json({ message: "Enter your first name and phone number" });
  }

  const hashedToken = hashToken(token);
  const inviteRecord = await prisma.inviteToken.findUnique({
    where: { token: hashedToken },
    include: { user: { select: { role: true, is_deleted: true } } },
  });

  if (!inviteRecord || inviteRecord.email !== email.toLowerCase().trim()) {
    return res.status(400).json({ message: "This invite link isn't valid" });
  }
  if (inviteRecord.used || inviteRecord.user.is_deleted) {
    return res.status(400).json({ message: "This invite has already been used. Sign in with your email and password." });
  }
  if (new Date() > inviteRecord.expires_at) {
    return res.status(400).json({
      message: "This invite link has expired. Ask the person who invited you to send a new one.",
    });
  }

  const hashedPassword = await hashPassword(password);
  const lastName = typeof last_name === "string" && last_name.trim() ? last_name.trim() : null;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: inviteRecord.user_id },
      data: {
        first_name: (first_name as string).trim(),
        last_name: lastName,
        phone_number: (phone_number as string).trim(),
        password: hashedPassword,
        is_active: true,
        onboarding_completed: true,
      },
    }),
    prisma.inviteToken.update({
      where: { token: hashedToken },
      data: { used: true },
    }),
  ]);

  return res.status(200).json({ message: "Account ready" });
}
