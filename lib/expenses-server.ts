import prisma from "@/lib/prisma";
import { ownedGymWhere, type Access } from "@/lib/access";

/**
 * Checks that a gym (and optional location) belongs to this owner, and for
 * staff that it's their assigned gym. Returns an error message, or null when
 * it's theirs.
 */
export async function verifyGymAndLocation(
  access: Access,
  gymId: unknown,
  locationId: unknown
): Promise<string | null> {
  if (typeof gymId !== "string" || !gymId) return "Select a gym first";
  const gym = await prisma.gym.findFirst({
    where: { id: gymId, is_deleted: false, AND: [ownedGymWhere(access)] },
    select: { id: true },
  });
  if (!gym) return "Gym not found or does not belong to you";

  if (locationId !== undefined && locationId !== null && locationId !== "") {
    if (typeof locationId !== "string") return "Invalid location";
    const location = await prisma.location.findFirst({
      where: { id: locationId, gym_id: gymId, is_deleted: false },
      select: { id: true },
    });
    if (!location) return "Location not found or does not belong to the gym";
  }
  return null;
}

/** Loads an expense only if it belongs to one of this access's gyms. */
export function findOwnedExpense(access: Access, id: string) {
  return prisma.expense.findFirst({
    where: { id, is_deleted: false, gym: { AND: [ownedGymWhere(access)], is_deleted: false } },
  });
}
