'use client'
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import BreadCrumbs from "./breadcrumbs"
import ProfileDropdown from "./profile"
import { AnimatedThemeToggler } from "../ui/animated-theme-toggler"
import { GymLocationSelector } from "./gym-location-selector"
import { useSession } from "next-auth/react"
import { useCallback, useEffect, useRef } from "react"

export function SiteHeader() {
  const { data: session, update } = useSession()
  const isGymOwner = session?.user?.role === 'GYM_OWNER'
  const gyms = session?.user?.gyms || []
  const locations = session?.user?.locations || []
  const selectedGymId = session?.user?.selected_gym_id
  const selectedLocationId = session?.user?.selected_location_id

  // Handle gym change
  const handleGymChange = useCallback(async (gymId: string) => {
    // Find the first location of the selected gym
    const gymLocations = locations.filter(loc => loc.gymId === gymId)
    const firstLocationId = gymLocations.length > 0 ? gymLocations[0].id : ""
    
    await update({
      user: {
        ...session?.user,
        selected_gym_id: gymId,
        selected_location_id: firstLocationId || null
      }
    })
  }, [locations, session?.user, update])

  // Handle location change
  const handleLocationChange = useCallback(async (locationId: string) => {
    await update({
      user: {
        ...session?.user,
        selected_location_id: locationId || null
      }
    })
  }, [session?.user, update])

  // Track if we've initialized defaults to prevent re-running
  const hasInitializedDefaults = useRef(false)

  // Set default selections on mount if not already set
  useEffect(() => {
    if (
      isGymOwner && 
      gyms.length > 0 && 
      !selectedGymId && 
      session?.user &&
      !hasInitializedDefaults.current
    ) {
      const firstGym = gyms[0]
      const firstGymLocations = locations.filter(loc => loc.gymId === firstGym.id)
      const firstLocationId = firstGymLocations.length > 0 ? firstGymLocations[0].id : null
      
      hasInitializedDefaults.current = true
      update({
        user: {
          ...session.user,
          selected_gym_id: firstGym.id,
          selected_location_id: firstLocationId
        }
      })
    }
  }, [isGymOwner, gyms, locations, selectedGymId, session?.user, update])

  // Map locations to match the expected type (convert null to undefined)
  const mappedLocations = locations.map(loc => ({
    id: loc.id,
    name: loc.name,
    gymId: loc.gymId,
    address: loc.address ?? undefined
  }))

  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6 py-2">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <BreadCrumbs />
        {isGymOwner && gyms.length > 0 && (
          <>
            <Separator
              orientation="vertical"
              className="mx-2 data-[orientation=vertical]:h-4"
            />
            <GymLocationSelector
              gyms={gyms}
              locations={mappedLocations}
              selectedGymId={selectedGymId || undefined}
              selectedLocationId={selectedLocationId || undefined}
              onGymChange={handleGymChange}
              onLocationChange={handleLocationChange}
            />
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <AnimatedThemeToggler />
          <ProfileDropdown />
        </div>
      </div>
    </header>
  )
}
