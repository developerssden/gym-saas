"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { Building2, Check, MapPin } from "lucide-react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

/** The signed-in owner's or staff member's gyms, branches and current choice, with setters. */
export function useGymLocation() {
  const { data: session, update } = useSession()

  const gyms = React.useMemo(() => session?.user?.gyms ?? [], [session?.user?.gyms])
  const locations = React.useMemo(() => session?.user?.locations ?? [], [session?.user?.locations])
  const selectedGymId = session?.user?.selected_gym_id
  const selectedLocationId = session?.user?.selected_location_id

  // Selecting a gym also moves the location to that gym's first location, so the
  // two ids never point at different gyms.
  const selectGym = React.useCallback(
    async (gymId: string) => {
      const firstLocationId = locations.find((loc) => loc.gymId === gymId)?.id ?? ""
      await update({
        user: { ...session?.user, selected_gym_id: gymId, selected_location_id: firstLocationId || null },
      })
    },
    [locations, session?.user, update]
  )

  const selectLocation = React.useCallback(
    async (locationId: string) => {
      await update({ user: { ...session?.user, selected_location_id: locationId || null } })
    },
    [session?.user, update]
  )

  const role = session?.user?.role
  const enabled = (role === "GYM_OWNER" || role === "STAFF") && gyms.length > 0
  const selectedGym = gyms.find((gym) => gym.id === selectedGymId)
  const gymLocations = selectedGymId ? locations.filter((loc) => loc.gymId === selectedGymId) : []
  const selectedLocation = gymLocations.find((loc) => loc.id === selectedLocationId)

  return {
    enabled,
    gyms,
    gymLocations,
    selectedGymId,
    selectedLocationId,
    gymLabel: selectedGym?.name ?? "Select gym",
    locationLabel: selectedLocation?.name ?? (gymLocations.length === 0 ? "No locations" : "Select location"),
    selectGym,
    selectLocation,
  }
}

/** Searchable list of gyms and the selected gym's branches. Calls onDone after a choice. */
export function GymLocationList({ onDone, className }: { onDone?: () => void; className?: string }) {
  const { gyms, gymLocations, selectedGymId, selectedLocationId, selectGym, selectLocation } = useGymLocation()

  return (
    <Command className={className}>
      <CommandInput placeholder="Search gyms or branches..." />
      <CommandList className="max-h-[60svh] md:max-h-[300px]">
        <CommandEmpty>No match found.</CommandEmpty>
        <CommandGroup heading="Gyms">
          {gyms.map((gym) => (
            <CommandItem
              key={gym.id}
              value={`gym-${gym.name}`}
              className="min-h-11 md:min-h-8"
              onSelect={() => {
                void selectGym(gym.id)
                onDone?.()
              }}
            >
              <Building2 className="size-4" />
              <span className="truncate">{gym.name}</span>
              {selectedGymId === gym.id && <Check className="ml-auto size-4" aria-label="Selected" />}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Branches">
          {gymLocations.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No branches for this gym yet.</p>
          ) : (
            gymLocations.map((location) => (
              <CommandItem
                key={location.id}
                value={`location-${location.name}`}
                className="min-h-11 md:min-h-8"
                onSelect={() => {
                  void selectLocation(location.id)
                  onDone?.()
                }}
              >
                <MapPin className="size-4" />
                <div className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate">{location.name}</span>
                  {location.address && (
                    <span className="truncate text-xs text-muted-foreground">{location.address}</span>
                  )}
                </div>
                {selectedLocationId === location.id && <Check className="ml-auto size-4" aria-label="Selected" />}
              </CommandItem>
            ))
          )}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}
