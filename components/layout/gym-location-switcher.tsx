"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { Building2, Check, ChevronsUpDown, MapPin } from "lucide-react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function GymLocationSwitcher() {
  const { data: session, update } = useSession()
  const { state, isMobile } = useSidebar()
  const [open, setOpen] = React.useState(false)

  const gyms = React.useMemo(() => session?.user?.gyms ?? [], [session?.user?.gyms])
  const locations = React.useMemo(
    () => session?.user?.locations ?? [],
    [session?.user?.locations]
  )
  const selectedGymId = session?.user?.selected_gym_id
  const selectedLocationId = session?.user?.selected_location_id

  // Selecting a gym also moves the location to that gym's first location, so the
  // two ids never point at different gyms.
  const handleGymChange = React.useCallback(
    async (gymId: string) => {
      const gymLocations = locations.filter((loc) => loc.gymId === gymId)
      const firstLocationId = gymLocations.length > 0 ? gymLocations[0].id : ""

      await update({
        user: {
          ...session?.user,
          selected_gym_id: gymId,
          selected_location_id: firstLocationId || null,
        },
      })
    },
    [locations, session?.user, update]
  )

  const handleLocationChange = React.useCallback(
    async (locationId: string) => {
      await update({
        user: {
          ...session?.user,
          selected_location_id: locationId || null,
        },
      })
    },
    [session?.user, update]
  )

  if (session?.user?.role !== "GYM_OWNER" || gyms.length === 0) {
    return null
  }

  const selectedGym = gyms.find((gym) => gym.id === selectedGymId)
  const filteredLocations = selectedGymId
    ? locations.filter((loc) => loc.gymId === selectedGymId)
    : []
  const selectedLocation = filteredLocations.find(
    (loc) => loc.id === selectedLocationId
  )

  const gymLabel = selectedGym?.name ?? "Select gym"
  const locationLabel = selectedLocation?.name
    ? selectedLocation.name
    : filteredLocations.length === 0
      ? "No locations"
      : "Select location"

  return (
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
        <Popover open={open} onOpenChange={setOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  role="combobox"
                  aria-expanded={open}
                  aria-label={`Change gym or location. Currently ${gymLabel}, ${locationLabel}`}
                >
                  <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                    <Building2 className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-sm font-semibold">
                      {gymLabel}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {locationLabel}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              align="center"
              hidden={state !== "collapsed" || isMobile}
            >
              {gymLabel} — {locationLabel}
            </TooltipContent>
          </Tooltip>

          <PopoverContent
            align="start"
            side={state === "collapsed" && !isMobile ? "right" : "bottom"}
            className="w-64 p-0"
          >
            <Command>
              <CommandInput placeholder="Search gyms or locations..." />
              <CommandList>
                <CommandEmpty>No match found.</CommandEmpty>
                <CommandGroup heading="Gyms">
                  {gyms.map((gym) => (
                    <CommandItem
                      key={gym.id}
                      value={`gym-${gym.name}`}
                      onSelect={() => {
                        handleGymChange(gym.id)
                        setOpen(false)
                      }}
                    >
                      <Building2 className="size-4" />
                      <span className="truncate">{gym.name}</span>
                      {selectedGymId === gym.id && (
                        <Check className="ml-auto size-4" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Locations">
                  {filteredLocations.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                      No locations for this gym yet.
                    </p>
                  ) : (
                    filteredLocations.map((location) => (
                      <CommandItem
                        key={location.id}
                        value={`location-${location.name}`}
                        onSelect={() => {
                          handleLocationChange(location.id)
                          setOpen(false)
                        }}
                      >
                        <MapPin className="size-4" />
                        <div className="grid min-w-0 flex-1 leading-tight">
                          <span className="truncate">{location.name}</span>
                          {location.address && (
                            <span className="truncate text-xs text-muted-foreground">
                              {location.address}
                            </span>
                          )}
                        </div>
                        {selectedLocationId === location.id && (
                          <Check className="ml-auto size-4" />
                        )}
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
          </Popover>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  )
}
