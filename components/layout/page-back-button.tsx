"use client"

import { useCallback, useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import { routeItems } from "@/constants/data"

function getParentPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length <= 1) return "/dashboard"
  return `/${segments.slice(0, -1).join("/")}`
}

export function PageBackButton() {
  const pathname = usePathname() || "/"
  const router = useRouter()
  const isMobile = useIsMobile()

  const showBackButton = useMemo(() => {
    if (!isMobile) return false
    return !routeItems.some((route) => route.href === pathname)
  }, [isMobile, pathname])

  const handleBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
      return
    }
    router.push(getParentPath(pathname))
  }, [pathname, router])

  if (!showBackButton) return null

  return (
    <div className="mb-3 md:hidden">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 h-9 gap-1.5 px-2 text-muted-foreground"
        onClick={handleBack}
        aria-label="Go back"
      >
        <ArrowLeft className="size-4" />
        Back
      </Button>
    </div>
  )
}
