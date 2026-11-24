// POST { token, password } → sets the new password and uses up every open reset link for that account.
// Returns the email so the page can sign them straight in.
import type { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/authHelper";
import { hashToken } from "@/lib/tokens";
import { PASSWORD_MIN_LENGTH } from "@/lib/profile";
import { RESET_TOKEN_MESSAGES, resetTokenProblem } from "@/lib/password-reset";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (password.length < PASSWORD_MIN_LENGTH) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: `Use at least ${PASSWORD_MIN_LENGTH} characters`, field: "password" });
  }

  try {
    const hashed = token ? hashToken(token) : "";
    const record = hashed
      ? await prisma.passwordResetToken.findUnique({
          where: { token: hashed },
          include: { user: { select: { id: true, email: true, is_active: true, is_deleted: true } } },
        })
      : null;

    const problem = resetTokenProblem(record);
    if (problem || !record) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: RESET_TOKEN_MESSAGES[problem ?? "invalid"], reason: problem ?? "invalid" });
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.user_id }, data: { password: await hashPassword(password) } }),
      prisma.passwordResetToken.updateMany({ where: { user_id: record.user_id, used: false }, data: { used: true } }),
    ]);

    return res.status(StatusCodes.OK).json({ message: "Password changed", email: record.user.email });
  } catch (err) {
    console.error("[password/reset]", err);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Something went wrong. Please try again." });
  }
}
