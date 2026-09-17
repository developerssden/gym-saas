import prisma from "@/lib/prisma";

export type SubscriptionValidationResult = {
  isActive: boolean;
  limits: {
    max_gyms: number;
    max_locations: number;
    max_members: number;
    max_equipment: number;
    max_staff: number;
    max_classes: number;
  };
  currentCounts: {
    gyms: number;
    locations: number;
    members: number;
    equipment: number;
    staff: number;
    classes: number;
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
      max_staff: number;
      max_classes: number;
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

export type LimitResourceType =
  | "gym"
  | "location"
  | "member"
  | "equipment"
  | "staff"
  | "class";

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

  const gymsCount = await prisma.gym.count({
    where: { owner_id: ownerId, is_deleted: false },
  });

  const locationsCount = await prisma.location.count({
    where: {
      is_deleted: false,
      gym: { owner_id: ownerId, is_deleted: false },
    },
  });

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

  const staffCount = await prisma.staff.count({
    where: {
      is_deleted: false,
      gym: { owner_id: ownerId, is_deleted: false },
    },
  });

  const classesCount = await prisma.gymClass.count({
    where: {
      is_deleted: false,
      gym: { owner_id: ownerId, is_deleted: false },
    },
  });

  const emptyLimits = {
    max_gyms: 0,
    max_locations: 0,
    max_members: 0,
    max_equipment: 0,
    max_staff: 0,
    max_classes: 0,
  };

  const currentCounts = {
    gyms: gymsCount,
    locations: locationsCount,
    members: membersCount,
    equipment: equipmentCount,
    staff: staffCount,
    classes: classesCount,
  };

  if (!activeSub?.plan) {
    return {
      isActive: false,
      limits: emptyLimits,
      currentCounts,
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
      max_staff: activeSub.plan.max_staff,
      max_classes: activeSub.plan.max_classes,
    },
    currentCounts,
    subscription: {
      id: activeSub.id,
      plan: {
        id: activeSub.plan.id,
        name: activeSub.plan.name,
        max_gyms: activeSub.plan.max_gyms,
        max_locations: activeSub.plan.max_locations,
        max_members: activeSub.plan.max_members,
        max_equipment: activeSub.plan.max_equipment,
        max_staff: activeSub.plan.max_staff,
        max_classes: activeSub.plan.max_classes,
      },
    },
  };
}

/**
 * Check if adding a resource would exceed the limit
 * For members, equipment, staff, and classes, limits are PER LOCATION
 * For gyms and locations, limits are TOTAL across all owner's gyms
 * Staff/class without locationId skip per-location enforcement (same as equipment create)
 */
export async function checkLimitExceeded(
  ownerId: string,
  resourceType: LimitResourceType,
  locationId?: string
): Promise<LimitCheckResult> {
  const validation = await validateOwnerSubscription(ownerId);

  if (!validation.isActive || !validation.subscription) {
    return {
      exceeded: false,
      current: 0,
      max: 0,
      resourceType,
    };
  }

  const { limits } = validation;

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

  if (
    resourceType === "staff" ||
    resourceType === "class"
  ) {
    if (!locationId) {
      return {
        exceeded: false,
        current: 0,
        max: 0,
        resourceType,
      };
    }
  }

  if (
    resourceType === "member" ||
    resourceType === "equipment" ||
    resourceType === "staff" ||
    resourceType === "class"
  ) {
    if (!locationId) {
      throw new Error(
        `locationId is required for ${resourceType} limit validation`
      );
    }

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

    if (resourceType === "staff") {
      const current = await prisma.staff.count({
        where: {
          location_id: locationId,
          is_deleted: false,
        },
      });
      const max = limits.max_staff;
      return {
        exceeded: current >= max,
        current,
        max,
        resourceType,
        locationId,
      };
    }

    if (resourceType === "class") {
      const current = await prisma.gymClass.count({
        where: {
          location_id: locationId,
          is_deleted: false,
        },
      });
      const max = limits.max_classes;
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
