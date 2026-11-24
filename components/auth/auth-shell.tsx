import { APP_NAME } from "@/constants/brand";
import { BrandMark } from "@/components/common/brand-mark";
import { LoginBrandPanel } from "@/components/auth/login-brand-panel";
import { cn } from "@/lib/utils";

/**
 * The sign-in look (dark theme, brand panel) for every page before the app:
 * sign in, forgot / reset password and onboarding.
 * `compact` swaps the tall brand panel for a slim logo bar on phones so a form starts near the top.
 */
export function AuthShell({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <div className="login-theme flex min-h-svh flex-col bg-background lg:flex-row">
      {compact ? (
        <>
          <header className="flex items-center gap-2 border-b border-border-soft bg-panel px-5 py-4 lg:hidden">
            <BrandMark className="h-5" />
            <span className="font-display text-[15px] font-bold tracking-tight text-foreground">{APP_NAME}</span>
          </header>
          <div className="hidden lg:contents">
            <LoginBrandPanel />
          </div>
        </>
      ) : (
        <LoginBrandPanel />
      )}
      <main
        className={cn(
          "flex flex-1 justify-center bg-background px-5 py-10 sm:px-8 lg:w-[56%] lg:items-center lg:px-12",
          compact ? "items-start" : "items-center"
        )}
      >
        {children}
      </main>
    </div>
  );
}

/** Shared field and button styles for the auth forms (dark login theme). */
export const authInput = cn(
  "h-11 rounded-md border-border bg-surface text-foreground shadow-none",
  "placeholder:text-faint md:text-sm",
  "focus-visible:border-primary-dim focus-visible:ring-0 focus-visible:shadow-[0_0_0_3px_var(--ring)]"
);

export const authButton = cn(
  "h-11 w-full rounded-[7px] bg-primary text-sm font-semibold text-primary-foreground",
  "hover:bg-primary-hover",
  "active:translate-y-px motion-reduce:active:translate-y-0",
  "focus-visible:border-primary-dim focus-visible:ring-0 focus-visible:shadow-[0_0_0_3px_var(--ring)]"
);

export const authLink =
  "text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:rounded-sm focus-visible:text-foreground focus-visible:shadow-[0_0_0_3px_var(--ring)]";

export function AuthHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8">
      {/* h2: the brand panel holds the page's h1. */}
      <h2 className="font-display text-[26px] leading-tight font-bold tracking-tight text-foreground">{title}</h2>
      {children && <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">{children}</p>}
    </div>
  );
}
