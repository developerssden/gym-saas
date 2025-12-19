import prisma from "@/lib/prisma";

export type SubscriptionValidationResult = {
  isActive: boolean;
  limits: {
    max_gyms: number;
    max_locations: number;
    max_members: number;
    max_equipment: number;
  };
  currentCounts: {
    gyms: number;
    locations: number;
    members: number;
    equipment: number;
  };
  subscription: {
    id: string;
    plan: {
      id: string;
      name: string;
      max_gyms: number;
      max_locations: number;
      max_members: number;
      max_equipment: number;
    };
  } | null;
};

export type LimitCheckResult = {
  exceeded: boolean;
  current: number;
  max: number;
  resourceType: string;
  locationId?: string;
};

/**
 * Validate owner subscription and get limits
 */
export async function validateOwnerSubscription(
  ownerId: string
): Promise<SubscriptionValidationResult> {
  const activeSub = await prisma.ownerSubscription.findFirst({
    where: {
      owner_id: ownerId,
      is_deleted: false,
      is_active: true,
      is_expired: false,
    },
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });

  // Get current counts
  const gymsCount = await prisma.gym.count({
    where: { owner_id: ownerId, is_deleted: false },
  });

  const locationsCount = await prisma.location.count({
    where: {
      is_deleted: false,
      gym: { owner_id: ownerId, is_deleted: false },
    },
  });

  // Count members across all owner's gyms (for total count display)
  const membersCount = await prisma.member.count({
    where: {
      gym: { owner_id: ownerId, is_deleted: false },
    },
  });

  const equipmentCount = await prisma.equipment.count({
    where: {
      is_deleted: false,
      gym: { owner_id: ownerId, is_deleted: false },
    },
  });

  if (!activeSub?.plan) {
    return {
      isActive: false,
      limits: {
        max_gyms: 0,
        max_locations: 0,
        max_members: 0,
        max_equipment: 0,
      },
      currentCounts: {
        gyms: gymsCount,
        locations: locationsCount,
        members: membersCount,
        equipment: equipmentCount,
      },
      subscription: null,
    };
  }

  return {
    isActive: true,
    limits: {
      max_gyms: activeSub.plan.max_gyms,
      max_locations: activeSub.plan.max_locations,
      max_members: activeSub.plan.max_members,
      max_equipment: activeSub.plan.max_equipment,
    },
    currentCounts: {
      gyms: gymsCount,
      locations: locationsCount,
      members: membersCount,
      equipment: equipmentCount,
    },
    subscription: {
      id: activeSub.id,
      plan: {
        id: activeSub.plan.id,
        name: activeSub.plan.name,
        max_gyms: activeSub.plan.max_gyms,
        max_locations: activeSub.plan.max_locations,
        max_members: activeSub.plan.max_members,
        max_equipment: activeSub.plan.max_equipment,
      },
    },
  };
}

/**
 * Check if adding a resource would exceed the limit
 * For members and equipment, limits are PER LOCATION
 * For gyms and locations, limits are TOTAL across all owner's gyms
 */
export async function checkLimitExceeded(
  ownerId: string,
  resourceType: "gym" | "location" | "member" | "equipment",
  locationId?: string
): Promise<LimitCheckResult> {
  const validation = await validateOwnerSubscription(ownerId);

  if (!validation.isActive || !validation.subscription) {
    // No active subscription - allow (or handle based on business logic)
    return {
      exceeded: false,
      current: 0,
      max: 0,
      resourceType,
    };
  }

  const { limits } = validation;

  // For gym and location: check total count
  if (resourceType === "gym") {
    const current = validation.currentCounts.gyms;
    const max = limits.max_gyms;
    return {
      exceeded: current >= max,
      current,
      max,
      resourceType,
    };
  }

  if (resourceType === "location") {
    const current = validation.currentCounts.locations;
    const max = limits.max_locations;
    return {
      exceeded: current >= max,
      current,
      max,
      resourceType,
    };
  }

  // For member and equipment: check PER LOCATION
  if (resourceType === "member" || resourceType === "equipment") {
    if (!locationId) {
      throw new Error(
        `locationId is required for ${resourceType} limit validation`
      );
    }

    // Verify location belongs to owner
    const location = await prisma.location.findFirst({
      where: {
        id: locationId,
        is_deleted: false,
        gym: { owner_id: ownerId, is_deleted: false },
      },
    });

    if (!location) {
      throw new Error("Location not found or does not belong to owner");
    }

    // Count members/equipment in this specific location
    if (resourceType === "member") {
      const current = await prisma.member.count({
        where: {
          location_id: locationId,
        },
      });
      const max = limits.max_members;
      return {
        exceeded: current >= max,
        current,
        max,
        resourceType,
        locationId,
      };
    }

    if (resourceType === "equipment") {
      const current = await prisma.equipment.count({
        where: {
          location_id: locationId,
          is_deleted: false,
        },
      });
      const max = limits.max_equipment;
      return {
        exceeded: current >= max,
        current,
        max,
        resourceType,
        locationId,
      };
    }
  }

  return {
    exceeded: false,
    current: 0,
    max: 0,
    resourceType,
  };
}

