"use client"

import * as React from "react"
import { Building2, ChevronDown, ChevronsUpDown } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { GymLocationList, useGymLocation } from "./gym-location-picker"

/** Gym and branch switcher at the top of the sidebar. */
export function GymLocationSwitcher() {
  const { state, isMobile } = useSidebar()
  const [open, setOpen] = React.useState(false)
  const { enabled, gymLabel, locationLabel } = useGymLocation()

  if (!enabled) return null

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
                    aria-label={`Change gym or branch. Currently ${gymLabel}, ${locationLabel}`}
                  >
                    <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                      <Building2 className="size-4" />
                    </div>
                    <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate text-sm font-semibold">{gymLabel}</span>
                      <span className="truncate text-xs text-muted-foreground">{locationLabel}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50 group-data-[collapsible=icon]:hidden" />
                  </SidebarMenuButton>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="right" align="center" hidden={state !== "collapsed" || isMobile}>
                {gymLabel} — {locationLabel}
              </TooltipContent>
            </Tooltip>

            <PopoverContent
              align="start"
              side={state === "collapsed" && !isMobile ? "right" : "bottom"}
              className="w-64 p-0"
            >
              <GymLocationList onDone={() => setOpen(false)} />
            </PopoverContent>
          </Popover>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  )
}

/**
 * Phones: the current gym and branch in the header. Tapping it opens a sheet
 * to switch, so the branch is visible and changeable from every page.
 */
export function MobileBranchButton() {
  const [open, setOpen] = React.useState(false)
  const { enabled, gymLabel, locationLabel } = useGymLocation()

  if (!enabled) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 md:hidden"
        aria-label={`Change gym or branch. Currently ${gymLabel}, ${locationLabel}`}
        aria-haspopup="dialog"
      >
        <div className="grid min-w-0 leading-tight">
          <span className="truncate text-sm font-semibold">{gymLabel}</span>
          <span className="truncate text-xs text-muted-foreground">{locationLabel}</span>
        </div>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <Drawer open={open} onOpenChange={setOpen} repositionInputs={false}>
        <DrawerContent className="max-h-[85svh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Gym and branch</DrawerTitle>
            <DrawerDescription>Choose the gym and branch you&apos;re working in.</DrawerDescription>
          </DrawerHeader>
          <div className="px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {open && <GymLocationList onDone={() => setOpen(false)} className="bg-transparent" />}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
