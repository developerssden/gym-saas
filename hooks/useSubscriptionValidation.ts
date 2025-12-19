"use client"

import { useSession } from "next-auth/react"
import { useMemo } from "react"

export function useSubscriptionValidation() {
  const { data: session } = useSession()

  const isSubscriptionActive = useMemo(() => {
    return session?.user?.subscription_active ?? false
  }, [session])

  const subscriptionLimits = useMemo(() => {
    return session?.user?.subscription_limits ?? {
      max_gyms: 0,
      max_locations: 0,
      max_members: 0,
      max_equipment: 0,
    }
  }, [session])

  const checkLimitBeforeAction = async (
    resourceType: "gym" | "location" | "member" | "equipment",
    locationId?: string
  ): Promise<{ exceeded: boolean; limitInfo?: any }> => {
    if (!isSubscriptionActive) {
      return {
        exceeded: true,
        limitInfo: {
          current: 0,
          max: 0,
          resourceType,
          message: "Subscription is expired or inactive",
        },
      }
    }

    // Client-side check - actual validation happens on server
    // This is just for UI feedback
    return {
      exceeded: false,
    }
  }

  return {
    isSubscriptionActive,
    subscriptionLimits,
    checkLimitBeforeAction,
    subscriptionExpired: session?.user?.subscription_expired ?? true,
  }
}

