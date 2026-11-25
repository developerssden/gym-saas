// GET /api/subscription/myplan: the signed-in owner's plan, its status and how
// much of each limit they use. Owners only (staff are refused).
import type { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { requireAccess } from "@/lib/access";
import { countStaffSeats } from "@/lib/subscription-validation";
import { buildPlanUsage, planFeatures, planStatus } from "@/lib/my-plan";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  const access = await requireAccess(req, res);
  if (!access?.ownerId) return;
  const ownerId = access.ownerId;

  try {
    const gymWhere = { owner_id: ownerId, is_deleted: false };
    const [active, latest, gyms, locations, staff] = await Promise.all([
      prisma.ownerSubscription.findFirst({
        where: { owner_id: ownerId, is_deleted: false, is_active: true, is_expired: false },
        orderBy: { createdAt: "desc" },
        include: { plan: true },
      }),
      // For "your plan ended on …" when nothing is active.
      prisma.ownerSubscription.findFirst({
        where: { owner_id: ownerId, is_deleted: false },
        orderBy: { end_date: "desc" },
        include: { plan: true },
      }),
      prisma.gym.count({ where: gymWhere }),
      prisma.location.findMany({
        where: { is_deleted: false, gym: gymWhere },
        select: {
          name: true,
          gym: { select: { name: true } },
          _count: { select: { members: true, equipment: { where: { is_deleted: false } } } },
        },
        orderBy: [{ gym: { name: "asc" } }, { name: "asc" }],
      }),
      countStaffSeats(ownerId),
    ]);

    const subscription = active ?? latest;
    const plan = subscription?.plan ?? null;
    const limits = {
      max_gyms: plan?.max_gyms ?? 0,
      max_locations: plan?.max_locations ?? 0,
      max_members: plan?.max_members ?? 0,
      max_equipment: plan?.max_equipment ?? 0,
      max_staff: plan?.max_staff ?? 0,
    };
    const showGymName = new Set(locations.map(l => l.gym.name)).size > 1;

    return res.status(StatusCodes.OK).json({
      status: planStatus(subscription ?? null),
      plan: plan
        ? {
            name: plan.name,
            billing_model: String(subscription!.billing_model),
            price: subscription!.billing_model === "YEARLY" ? plan.yearly_price : plan.monthly_price,
            custom_pricing: plan.is_custom_pricing,
            start_date: subscription!.start_date,
            end_date: subscription!.end_date,
          }
        : null,
      limits,
      features: plan ? planFeatures(limits) : [],
      usage: buildPlanUsage(
        limits,
        { gyms, locations: locations.length, staff },
        locations.map(l => ({
          name: showGymName ? `${l.gym.name} · ${l.name}` : l.name,
          members: l._count.members,
          equipment: l._count.equipment,
        }))
      ),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
