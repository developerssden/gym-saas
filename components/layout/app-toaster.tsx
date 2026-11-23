"use client";

import { Toaster } from "@/components/ui/sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMobileTabBar } from "./mobile-tab-bar";

/**
 * Toasts top-right on larger screens; bottom-centre on phones, above the tab
 * bar, so they never cover the header (branch, bell, profile).
 */
export function AppToaster() {
  const isMobile = useIsMobile();
  const tabBar = useMobileTabBar();
  return (
    <Toaster
      richColors
      position={isMobile ? "bottom-center" : "top-right"}
      mobileOffset={{ bottom: tabBar ? "calc(4.5rem + env(safe-area-inset-bottom))" : "calc(1rem + env(safe-area-inset-bottom))" }}
    />
  );
}
