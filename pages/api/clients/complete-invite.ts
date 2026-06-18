import { hashPassword } from "@/lib/authHelper";
import prisma from "@/lib/prisma";
import { hashToken } from "@/lib/tokens";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const {
    token,
    email,
    password,
    first_name,
    last_name,
    phone_number,
    date_of_birth,
    address,
    city,
    state,
    zip_code,
    country,
    cnic,
  } = req.body;

  if (
    !token ||
    !email ||
    !password ||
    !first_name ||
    !last_name ||
    !phone_number ||
    !date_of_birth ||
    !address ||
    !city ||
    !state ||
    !zip_code ||
    !country
  ) {
    return res.status(400).json({ message: "All required fields must be filled" });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  const hashedToken = hashToken(token);
  const inviteRecord = await prisma.inviteToken.findUnique({
    where: { token: hashedToken },
  });

  if (!inviteRecord) {
    return res.status(400).json({ message: "Invalid invite link" });
  }

  if (inviteRecord.used) {
    return res.status(400).json({ message: "This invite link has already been used" });
  }

  if (new Date() > inviteRecord.expires_at) {
    return res.status(400).json({
      message: "This invite link has expired. Please contact your administrator.",
    });
  }

  if (inviteRecord.email !== email.toLowerCase().trim()) {
    return res.status(400).json({ message: "Invalid invite link" });
  }

  const hashedPassword = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: inviteRecord.user_id },
      data: {
        first_name,
        last_name,
        phone_number,
        date_of_birth: new Date(date_of_birth),
        address,
        city,
        state,
        zip_code,
        country,
        cnic: cnic ?? null,
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

  return res.status(200).json({ message: "Account setup complete. You can now sign in." });
}
