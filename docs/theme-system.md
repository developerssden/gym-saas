# Theme System — Cursor Implementation Guide

## What we're building

A theme picker that replaces the existing theme toggle button with a dropdown showing:

- System / Light / Dark (mode options)
- Any custom themes defined in `lib/themes.ts` (e.g. "Warm Orange", "Ocean Blue")

Theme choice persists in a cookie so it survives page reloads and SSR without flash.

Stack: Next.js App Router, Tailwind v4, shadcn/ui, `next-themes` (already installed for the existing toggle).

---

## How it works end-to-end

1. `lib/themes.ts` — the single file where themes are defined. Adding a new theme here makes it appear in the dropdown automatically. No other file needs to change.
2. Each custom theme is a named set of CSS variable overrides. They are written as a `.theme-[name]` class on `<html>`.
3. `next-themes` handles system/light/dark. For custom themes, we set `data-theme` attribute on `<html>` alongside the light/dark class.
4. Cookie `app-theme` stores the user's choice. The provider reads it on first render to apply the theme before hydration (no flash).
5. The dropdown replaces the existing toggle button in `components/layout/header.tsx`.

---

## Step 1 — Create `lib/themes.ts`

This is the only file a developer needs to edit to add a new theme.

```ts
// lib/themes.ts

export interface AppTheme {
  name: string; // machine name, used as CSS class: theme-[name]
  label: string; // shown in the dropdown
  cssVars: Record<string, string>; // CSS custom property overrides
}

// ─── ADD YOUR CUSTOM THEMES HERE ───────────────────────────────────────────
// Each theme overrides any subset of the CSS variables defined in globals.css.
// The variable names must match exactly what's in :root {}.
// "name" becomes the class applied to <html>: class="theme-warm-orange dark"
// ───────────────────────────────────────────────────────────────────────────

export const customThemes: AppTheme[] = [
  {
    name: "warm-orange",
    label: "Warm Orange",
    cssVars: {
      "--primary": "oklch(0.6171 0.1375 39.0427)",
      "--primary-foreground": "oklch(1.0000 0 0)",
      "--ring": "oklch(0.6171 0.1375 39.0427)",
      "--sidebar-primary": "oklch(0.6171 0.1375 39.0427)",
      "--sidebar-primary-foreground": "oklch(0.9881 0 0)",
    },
  },
  // ── Example: add more themes below ──────────────────────────────────────
  // {
  //   name: 'ocean-blue',
  //   label: 'Ocean Blue',
  //   cssVars: {
  //     '--primary': 'oklch(0.55 0.18 240)',
  //     '--primary-foreground': 'oklch(1 0 0)',
  //     '--ring': 'oklch(0.55 0.18 240)',
  //     '--sidebar-primary': 'oklch(0.55 0.18 240)',
  //     '--sidebar-primary-foreground': 'oklch(0.99 0 0)',
  //   },
  // },
];

// All selectable options in the dropdown (mode + themes)
export type ThemeMode = "system" | "light" | "dark";

export const themeModes: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
```

---

## Step 2 — Add CSS classes to `app/globals.css`

At the bottom of `globals.css`, add one class per custom theme. Each class overrides the CSS variables for that theme.

The `@layer base` block is already there — add the theme classes inside it:

```css
/* Add inside @layer base { } in globals.css */

/* ── Custom themes ── */
/* When you add a theme to lib/themes.ts, paste its CSS class here too.     */
/* The class name must be: .theme-[name] matching the `name` field exactly. */

.theme-warm-orange {
  --primary: oklch(0.6171 0.1375 39.0427);
  --primary-foreground: oklch(1 0 0);
  --ring: oklch(0.6171 0.1375 39.0427);
  --sidebar-primary: oklch(0.6171 0.1375 39.0427);
  --sidebar-primary-foreground: oklch(0.9881 0 0);
}

/* .theme-ocean-blue {
  --primary: oklch(0.55 0.18 240);
  --primary-foreground: oklch(1 0 0);
  --ring: oklch(0.55 0.18 240);
  --sidebar-primary: oklch(0.55 0.18 240);
  --sidebar-primary-foreground: oklch(0.99 0 0);
} */
```

Note: The `cssVars` in `lib/themes.ts` and the CSS class in `globals.css` must stay in sync. The CSS class is what actually applies the styles. The `cssVars` object in `lib/themes.ts` is used to generate the color swatch in the dropdown.

---

## Step 3 — Create `providers/theme-provider.tsx` (replace existing)

The existing `theme-provider.tsx` wraps `next-themes`. Replace it with a version that also handles custom theme classes and cookie persistence.

```tsx
// providers/theme-provider.tsx
"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { customThemes } from "@/lib/themes";

const THEME_COOKIE = "app-theme";
const CUSTOM_THEME_COOKIE = "app-custom-theme";

function getThemeCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="))
    ?.split("=")[1];
}

function setThemeCookie(name: string, value: string) {
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

interface CustomThemeContextValue {
  customTheme: string | null;
  setCustomTheme: (name: string | null) => void;
}

export const CustomThemeContext = React.createContext<CustomThemeContextValue>({
  customTheme: null,
  setCustomTheme: () => {},
});

export function useCustomTheme() {
  return React.useContext(CustomThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [customTheme, setCustomThemeState] = React.useState<string | null>(
    () => getThemeCookie(CUSTOM_THEME_COOKIE) ?? null,
  );

  // Apply custom theme class to <html>
  React.useEffect(() => {
    const html = document.documentElement;
    // Remove all existing custom theme classes
    customThemes.forEach((t) => html.classList.remove(`theme-${t.name}`));
    if (customTheme) {
      html.classList.add(`theme-${customTheme}`);
    }
  }, [customTheme]);

  function setCustomTheme(name: string | null) {
    setCustomThemeState(name);
    if (name) {
      setThemeCookie(CUSTOM_THEME_COOKIE, name);
    } else {
      document.cookie = `${CUSTOM_THEME_COOKIE}=; path=/; max-age=0`;
    }
  }

  return (
    <CustomThemeContext.Provider value={{ customTheme, setCustomTheme }}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey={THEME_COOKIE}
      >
        {children}
      </NextThemesProvider>
    </CustomThemeContext.Provider>
  );
}
```

---

## Step 4 — Create `components/layout/theme-switcher.tsx`

This is the dropdown component that replaces the existing toggle button.

```tsx
// components/layout/theme-switcher.tsx
"use client";

import { useTheme } from "next-themes";
import { useCustomTheme } from "@/providers/theme-provider";
import { customThemes, themeModes } from "@/lib/themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Check, Moon, Sun, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const modeIcons: Record<string, React.ReactNode> = {
  system: <Monitor className="h-4 w-4" />,
  light: <Sun className="h-4 w-4" />,
  dark: <Moon className="h-4 w-4" />,
};

export function ThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { customTheme, setCustomTheme } = useCustomTheme();

  // The current active display label for the trigger button
  const activeCustom = customThemes.find((t) => t.name === customTheme);
  const activeMode = themeModes.find((m) => m.value === theme);

  function handleModeSelect(mode: string) {
    setTheme(mode);
    // Keep the custom colour theme when switching light/dark/system
  }

  function handleCustomThemeSelect(name: string) {
    if (customTheme === name) {
      // Toggle off if already selected
      setCustomTheme(null);
    } else {
      setCustomTheme(name);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          {resolvedTheme === "dark" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        {/* ── Mode: System / Light / Dark ── */}
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Mode
        </DropdownMenuLabel>
        {themeModes.map((mode) => (
          <DropdownMenuItem
            key={mode.value}
            onClick={() => handleModeSelect(mode.value)}
            className="flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              {modeIcons[mode.value]}
              {mode.label}
            </span>
            {theme === mode.value && (
              <Check className="h-3.5 w-3.5 text-primary" />
            )}
          </DropdownMenuItem>
        ))}

        {/* ── Custom colour themes ── */}
        {customThemes.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Colour
            </DropdownMenuLabel>
            {customThemes.map((t) => {
              const isActive = customTheme === t.name;
              const swatchColor = t.cssVars["--primary"] ?? "var(--primary)";
              return (
                <DropdownMenuItem
                  key={t.name}
                  onClick={() => handleCustomThemeSelect(t.name)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    {/* Colour swatch */}
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-border flex-shrink-0"
                      style={{ background: swatchColor }}
                    />
                    {t.label}
                  </span>
                  {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## Step 5 — Replace the toggle in `components/layout/header.tsx`

Find the existing theme toggle button in `components/layout/header.tsx`. It will look something like:

```tsx
// FIND and DELETE something like this:
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
// or
import { ModeToggle } from '@/components/ui/mode-toggle'

// And its usage, something like:
<AnimatedThemeToggler />
// or
<ModeToggle />
```

Replace with:

```tsx
// ADD this import at the top of components/layout/header.tsx:
import { ThemeSwitcher } from "@/components/layout/theme-switcher";

// REPLACE the old toggle with:
<ThemeSwitcher />;
```

---

## Step 6 — Update `providers/providers.tsx`

Make sure the root providers file wraps everything in the updated `ThemeProvider`. Check `providers/providers.tsx` — it likely already imports `ThemeProvider`. Confirm it looks like this (update the import path if needed):

```tsx
// providers/providers.tsx
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/AuthProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <QueryProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryProvider>
    </AuthProvider>
  );
}
```

---

## Step 7 — SSR: read cookie in layout to avoid flash

To prevent a flash of the wrong theme on first load, read the cookie in the root layout and apply the class server-side.

In `app/layout.tsx`, update the `<html>` tag:

```tsx
// app/layout.tsx
import { cookies } from "next/headers";
import { customThemes } from "@/lib/themes";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const savedCustomTheme = cookieStore.get("app-custom-theme")?.value;
  const isValidTheme = customThemes.some((t) => t.name === savedCustomTheme);
  const themeClass = isValidTheme ? `theme-${savedCustomTheme}` : "";

  return (
    <html lang="en" suppressHydrationWarning className={themeClass}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

`suppressHydrationWarning` is required because `next-themes` modifies the class on the client.

---

## How to add a new theme (ongoing workflow)

Only two files need to change when adding a new theme:

**1. `lib/themes.ts` — add an entry to `customThemes`:**

```ts
{
  name: 'forest-green',       // kebab-case, no spaces
  label: 'Forest Green',      // shown in dropdown
  cssVars: {
    '--primary': 'oklch(0.52 0.14 150)',
    '--primary-foreground': 'oklch(1 0 0)',
    '--ring': 'oklch(0.52 0.14 150)',
    '--sidebar-primary': 'oklch(0.52 0.14 150)',
    '--sidebar-primary-foreground': 'oklch(0.99 0 0)',
  },
},
```

**2. `app/globals.css` — add the matching CSS class:**

```css
.theme-forest-green {
  --primary: oklch(0.52 0.14 150);
  --primary-foreground: oklch(1 0 0);
  --ring: oklch(0.52 0.14 150);
  --sidebar-primary: oklch(0.52 0.14 150);
  --sidebar-primary-foreground: oklch(0.99 0 0);
}
```

That's it. The dropdown will show it automatically.

---

## Implementation order

| #   | Task                                              | File              | Time   |
| --- | ------------------------------------------------- | ----------------- | ------ |
| 1   | Create `lib/themes.ts`                            | new file          | 10 min |
| 2   | Add `.theme-*` classes to `globals.css`           | `app/globals.css` | 5 min  |
| 3   | Replace `providers/theme-provider.tsx`            | existing file     | 15 min |
| 4   | Create `components/layout/theme-switcher.tsx`     | new file          | 10 min |
| 5   | Replace toggle in `components/layout/header.tsx`  | existing file     | 5 min  |
| 6   | Confirm `providers/providers.tsx` wraps correctly | existing file     | 5 min  |
| 7   | Add cookie read to `app/layout.tsx`               | existing file     | 10 min |

**Total: ~1 hour**

---

## What NOT to change

- `components/ui/animated-theme-toggler.tsx` — leave the file, just stop using it in the header. It may be used elsewhere.
- `next-themes` configuration — the existing `storageKey` and `attribute="class"` setup is correct, keep it.
- Any existing dark mode CSS — the `.dark` class in `globals.css` stays exactly as is. Custom themes layer on top of it, they don't replace it.
