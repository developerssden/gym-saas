"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { flushSync } from "react-dom"

import { cn } from "@/lib/utils"

export const useAnimatedThemeToggler = (duration = 400) => {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"))
    }

    updateTheme()

    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])

  const applyTheme = useCallback(() => {
    const newTheme = !isDark
    setIsDark(newTheme)
    document.documentElement.classList.toggle("dark")
    localStorage.setItem("theme", newTheme ? "dark" : "light")
  }, [isDark])

  const toggleTheme = useCallback(
    async (origin?: HTMLElement | null) => {
      // Read the rect up front: the origin may unmount (e.g. a closing dropdown
      // item) before the transition settles.
      const rect = origin?.getBoundingClientRect()

      if (!document.startViewTransition) {
        applyTheme()
        return
      }

      await document.startViewTransition(() => {
        flushSync(applyTheme)
      }).ready

      if (!rect) return

      const { top, left, width, height } = rect
      const x = left + width / 2
      const y = top + height / 2
      const maxRadius = Math.hypot(
        Math.max(left, window.innerWidth - left),
        Math.max(top, window.innerHeight - top)
      )

      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${maxRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        }
      )
    },
    [applyTheme, duration]
  )

  return { isDark, toggleTheme }
}

interface AnimatedThemeTogglerProps
  extends React.ComponentPropsWithoutRef<"button"> {
  duration?: number
}

export const AnimatedThemeToggler = ({
  className,
  duration = 400,
  ...props
}: AnimatedThemeTogglerProps) => {
  const { isDark, toggleTheme } = useAnimatedThemeToggler(duration)
  const buttonRef = useRef<HTMLButtonElement>(null)

  return (
    <button
      ref={buttonRef}
      onClick={() => toggleTheme(buttonRef.current)}
      className={cn(className)}
      {...props}
    >
      {isDark ? <Sun /> : <Moon />}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
