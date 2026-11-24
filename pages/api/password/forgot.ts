// POST { email } → emails a one-hour reset link if the email belongs to someone who signs in.
// Always gives the same reply so it can't be used to check which emails have accounts.
import type { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { generateToken, hashToken } from "@/lib/tokens";
import {
  EMAIL_PATTERN,
  FORGOT_PASSWORD_REPLY,
  RESETTABLE_ROLES,
  inCooldown,
  normalizeEmail,
  resetTokenExpiry,
} from "@/lib/password-reset";
import { buildResetUrl, sendPasswordResetEmail } from "@/lib/password-reset-email";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const email = normalizeEmail(req.body?.email);
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: "Enter a valid email" });
  }

  try {
    // The same account sign-in would find (lib: [...nextauth] authorize), limited to people with a password.
    const user = await prisma.user.findFirst({
      where: {
        email,
        is_deleted: false,
        is_active: true,
        role: { in: [...RESETTABLE_ROLES] },
        password: { not: null },
      },
      select: { id: true, first_name: true, email: true },
    });

    if (user?.email) {
      const last = await prisma.passwordResetToken.findFirst({
        where: { user_id: user.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      if (!inCooldown(last?.createdAt)) {
        const rawToken = generateToken();
        await prisma.passwordResetToken.create({
          data: { token: hashToken(rawToken), user_id: user.id, expires_at: resetTokenExpiry() },
        });
        await sendPasswordResetEmail(user.email, buildResetUrl(rawToken), user.first_name);
      }
    }
  } catch (err) {
    // Logged, not shown: the reply must not reveal whether the account exists.
    console.error("[password/forgot]", err);
  }

  return res.status(StatusCodes.OK).json({ message: FORGOT_PASSWORD_REPLY });
}
