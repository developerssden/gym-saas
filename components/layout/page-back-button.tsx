"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { routeItems } from "@/constants/data"

/** The page one level up, named as it is in the menu ("/members/import" → Members). */
export function parentPage(pathname: string): { href: string; title: string } | null {
  const segments = pathname.split("/").filter(Boolean)
  // Menu pages need no back link; they're one tap away in the menu.
  if (segments.length === 0 || routeItems.some((route) => route.href === pathname)) return null
  const href = segments.length > 1 ? `/${segments.slice(0, -1).join("/")}` : "/dashboard"
  const title = routeItems.find((route) => route.href === href)?.title ?? "Dashboard"
  return { href: routeItems.some((route) => route.href === href) ? href : "/dashboard", title }
}

/**
 * "← Members" above every page that isn't in the menu (forms, import, profile…).
 * The only back link on a page: pages shouldn't add their own.
 */
export function PageBackButton() {
  const pathname = usePathname() || "/"
  const parent = parentPage(pathname)
  if (!parent) return null

  return (
    <div className="mb-3">
      <Link
        href={parent.href}
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:min-h-9"
      >
        <ArrowLeft aria-hidden className="size-4" />
        <span className="sr-only">Back to </span>
        {parent.title}
      </Link>
    </div>
  )
}
