"use client";

import { useSession } from "next-auth/react";
import { useMemo } from "react";
import { useGyms } from "@/hooks/use-gyms";
import { useLocations } from "@/hooks/use-locations";

type SubscriptionValidationOptions = {
  gymCount?: number;
  locationCount?: number;
  includeLocationUsage?: boolean;
};

type LimitInfo = {
  current: number;
  max: number;
  resourceType: "gym" | "location" | "member" | "equipment";
  message: string;
};

type LimitCheckResult = {
  exceeded: boolean;
  limitInfo?: LimitInfo;
};

export function useSubscriptionValidation({
  gymCount,
  locationCount,
  includeLocationUsage = false,
}: SubscriptionValidationOptions = {}) {
  const { data: session } = useSession();
  const isGymOwner = session?.user?.role === "GYM_OWNER";

  const {
    data: gymUsageData,
    isLoading: isGymUsageLoading,
    refetch: refetchGymUsage,
  } = useGyms({
    page: 1,
    limit: 1,
    enabled: isGymOwner && gymCount === undefined,
  });
  const {
    data: locationUsageData,
    isLoading: isLocationUsageLoading,
    refetch: refetchLocationUsage,
  } = useLocations({
    page: 1,
    limit: 1,
    enabled: isGymOwner && includeLocationUsage && locationCount === undefined,
  });

  const isSubscriptionActive = useMemo(() => {
    return session?.user?.subscription_active ?? false;
  }, [session]);

  const subscriptionLimits = useMemo(() => {
    return (
      session?.user?.subscription_limits ?? {
        max_gyms: 0,
        max_locations: 0,
        max_members: 0,
        max_equipment: 0,
      }
    );
  }, [session]);

  const currentGyms = gymCount ?? gymUsageData?.totalCount ?? 0;
  const gymLimit = subscriptionLimits.max_gyms;
  const isAtGymLimit =
    isSubscriptionActive && gymLimit >= 0 && currentGyms >= gymLimit;
  const isNearGymLimit =
    gymLimit > 0 && !isAtGymLimit && currentGyms >= Math.max(1, gymLimit - 1);
  const currentLocations = locationCount ?? locationUsageData?.totalCount ?? 0;
  const locationLimit = subscriptionLimits.max_locations;
  const isAtLocationLimit =
    isSubscriptionActive &&
    locationLimit >= 0 &&
    currentLocations >= locationLimit;
  const isNearLocationLimit =
    locationLimit > 0 &&
    !isAtLocationLimit &&
    currentLocations >= Math.max(1, locationLimit - 1);

  const checkLimitBeforeAction = async (
    resourceType: "gym" | "location" | "member" | "equipment",
    locationId?: string,
  ): Promise<LimitCheckResult> => {
    void locationId;

    if (!isSubscriptionActive) {
      return {
        exceeded: true,
        limitInfo: {
          current: 0,
          max: 0,
          resourceType,
          message: "Subscription is expired or inactive",
        },
      };
    }

    if (resourceType === "gym") {
      const latestUsage =
        gymCount === undefined
          ? (await refetchGymUsage()).data?.totalCount
          : gymCount;
      const latestGymCount = latestUsage ?? currentGyms;
      const gymLimitExceeded =
        isSubscriptionActive && gymLimit >= 0 && latestGymCount >= gymLimit;

      if (!gymLimitExceeded) {
        return { exceeded: false };
      }

      return {
        exceeded: true,
        limitInfo: {
          current: latestGymCount,
          max: gymLimit,
          resourceType,
          message: `Gym limit reached (max ${gymLimit})`,
        },
      };
    }

    if (resourceType === "location") {
      const latestUsage =
        locationCount === undefined
          ? (await refetchLocationUsage()).data?.totalCount
          : locationCount;
      const latestLocationCount = latestUsage ?? currentLocations;
      const locationLimitExceeded =
        isSubscriptionActive &&
        locationLimit >= 0 &&
        latestLocationCount >= locationLimit;

      if (!locationLimitExceeded) {
        return { exceeded: false };
      }

      return {
        exceeded: true,
        limitInfo: {
          current: latestLocationCount,
          max: locationLimit,
          resourceType,
          message: `Location limit reached (max ${locationLimit})`,
        },
      };
    }

    // Member and equipment limits require server-side context such as location ID.
    return {
      exceeded: false,
    };
  };

  return {
    isSubscriptionActive,
    subscriptionLimits,
    checkLimitBeforeAction,
    subscriptionExpired: session?.user?.subscription_expired ?? true,
    currentGyms,
    gymLimit,
    isAtGymLimit,
    isNearGymLimit,
    isGymUsageLoading,
    refetchGymUsage,
    currentLocations,
    locationLimit,
    isAtLocationLimit,
    isNearLocationLimit,
    isLocationUsageLoading,
    refetchLocationUsage,
  };
}
