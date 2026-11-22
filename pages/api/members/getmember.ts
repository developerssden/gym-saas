// pages/api/members/getmember.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAccess, ownsGym } from "@/lib/access";
import { gymSummarySelect, locationSummarySelect, memberProfileUserSelect } from "@/lib/api-selects";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const access = await requireAccess(req, res, {
    permission: ["members.view", "members.edit"],
    allowAdmin: true,
  });
  if (!access) return;

  try {
    const { id } = req.body as { id?: string };
    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Member ID is required" });
    }

    const member = await prisma.member.findUnique({
      where: { id },
      select: {
        id: true,
        user_id: true,
        gym_id: true,
        location_id: true,
        joinedAt: true,
        // The edit form's fields only.
        user: { select: memberProfileUserSelect },
        gym: { select: { ...gymSummarySelect, owner_id: true } },
        location: { select: locationSummarySelect },
      },
    });

    if (!member) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Member not found" });
    }

    // Owners and staff: the member must be in one of their gyms
    if (!ownsGym(access, member.gym)) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "Forbidden – You can only access members from your gyms",
      });
    }

    // owner_id was only needed for the check above.
    const { owner_id: _ownerId, ...gym } = member.gym;
    void _ownerId;
    return res.status(StatusCodes.OK).json({ ...member, gym });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

