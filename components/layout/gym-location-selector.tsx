"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Building2, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type Gym = {
  id: string
  name: string
}

export type Location = {
  id: string
  name: string
  gymId: string
  address?: string
}

interface GymLocationSelectorProps {
  gyms: Gym[]
  locations: Location[]
  selectedGymId?: string
  selectedLocationId?: string
  onGymChange: (gymId: string) => void
  onLocationChange: (locationId: string) => void
  className?: string
}

export function GymLocationSelector({
  gyms,
  locations,
  selectedGymId,
  selectedLocationId,
  onGymChange,
  onLocationChange,
  className,
}: GymLocationSelectorProps) {
  const [openGym, setOpenGym] = React.useState(false)
  const [openLocation, setOpenLocation] = React.useState(false)

  const selectedGym = gyms.find((gym) => gym.id === selectedGymId)
  const filteredLocations = selectedGymId ? locations.filter((loc) => loc.gymId === selectedGymId) : []
  const selectedLocation = filteredLocations.find((loc) => loc.id === selectedLocationId)

  // Reset location when gym changes
  const handleGymChange = (gymId: string) => {
    onGymChange(gymId)
    // If current location doesn't belong to new gym, clear it
    const newLocations = locations.filter((loc) => loc.gymId === gymId)
    if (selectedLocationId && !newLocations.find((loc) => loc.id === selectedLocationId)) {
      onLocationChange("")
    }
  }

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:gap-3", className)}>
      {/* Gym Selector */}
      <Popover open={openGym} onOpenChange={setOpenGym}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={openGym}
            className="w-full justify-between sm:w-[240px] bg-transparent"
          >
            <div className="flex items-center gap-2 truncate">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              {selectedGym ? (
                <span className="truncate">{selectedGym.name}</span>
              ) : (
                <span className="text-muted-foreground">Select gym...</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[240px] p-0">
          <Command>
            <CommandInput placeholder="Search gym..." />
            <CommandList>
              <CommandEmpty>No gym found.</CommandEmpty>
              <CommandGroup>
                {gyms.map((gym) => (
                  <CommandItem
                    key={gym.id}
                    value={gym.name}
                    onSelect={() => {
                      handleGymChange(gym.id)
                      setOpenGym(false)
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", selectedGymId === gym.id ? "opacity-100" : "opacity-0")} />
                    {gym.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Location Selector */}
      <Popover open={openLocation} onOpenChange={setOpenLocation}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={openLocation}
            disabled={!selectedGymId || filteredLocations.length === 0}
            className="w-full justify-between sm:w-[240px] bg-transparent"
          >
            <div className="flex items-center gap-2 truncate">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              {selectedLocation ? (
                <span className="truncate">{selectedLocation.name}</span>
              ) : (
                <span className="text-muted-foreground">
                  {selectedGymId
                    ? filteredLocations.length === 0
                      ? "No locations"
                      : "Select location..."
                    : "Select gym first"}
                </span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[240px] p-0">
          <Command>
            <CommandInput placeholder="Search location..." />
            <CommandList>
              <CommandEmpty>No location found.</CommandEmpty>
              <CommandGroup>
                {filteredLocations.map((location) => (
                  <CommandItem
                    key={location.id}
                    value={location.name}
                    onSelect={() => {
                      onLocationChange(location.id)
                      setOpenLocation(false)
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", selectedLocationId === location.id ? "opacity-100" : "opacity-0")}
                    />
                    <div className="flex flex-col">
                      <span>{location.name}</span>
                      {location.address && <span className="text-xs text-muted-foreground">{location.address}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
