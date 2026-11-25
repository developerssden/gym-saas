'use client'
import { Suspense } from "react"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import BreadCrumbs from "./breadcrumbs"
import ProfileDropdown from "./profile"
import { MobileBranchButton } from "./gym-location-switcher"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { QuickPaymentButton } from "@/components/payments/QuickPaymentButton"
import { OfflineStatus } from "@/components/offline/OfflineStatus"
import { cn } from "@/lib/utils"
import { useMobileTabBar } from "./mobile-tab-bar"

export function SiteHeader() {
  // On phones the bottom tab bar has its own "Menu" button, so don't show a second one here.
  const tabBar = useMobileTabBar()
  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background transition-[width,height] ease-linear">
      <div className="flex w-full min-w-0 items-center gap-1 px-2 py-2 md:px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger
          className={cn("size-11 md:-ml-1 md:inline-flex md:size-7", tabBar && "hidden")}
          aria-label="Open menu"
        />
        <Separator
          orientation="vertical"
          className="mx-2 hidden data-[orientation=vertical]:h-4 md:block"
        />
        {/* Phones: which gym/branch you're in, tap to switch. Desktop: where you are. */}
        <MobileBranchButton />
        <Suspense fallback={null}>
          <BreadCrumbs />
        </Suspense>
        <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-2">
          <OfflineStatus />
          <QuickPaymentButton />
          <NotificationBell />
          <ProfileDropdown />
        </div>
      </div>
    </header>
  )
}
