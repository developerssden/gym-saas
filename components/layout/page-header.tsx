import * as React from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: React.ReactNode;
  /** One line saying what the page is for. */
  description?: React.ReactNode;
  /** Main page actions ("Add expense"). On phones they sit under the title and share the width. */
  actions?: React.ReactNode;
  /** Small extra next to the title, e.g. an "Updating" spinner. */
  titleAddon?: React.ReactNode;
  className?: string;
};

/**
 * Title, one-line description and the page's main actions. Stacks on phones so
 * long titles and several buttons never push each other off screen.
 * Actions can be Buttons or Links wrapping a Button.
 */
export function PageHeader({ title, description, actions, titleAddon, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="h1 break-words">{title}</h1>
          {titleAddon}
        </div>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end",
            // Buttons and links share the row on phones, 44px tall.
            "[&>a]:min-w-[8rem] [&>a]:flex-1 [&>button]:min-w-[8rem] [&>button]:flex-1 sm:[&>a]:flex-none sm:[&>button]:flex-none",
            "[&>a]:h-11 [&>button]:h-11 md:[&>a]:h-10 md:[&>button]:h-10",
            // <Link><Button/></Link>: the button fills the link.
            "[&>a>button]:h-full [&>a>button]:w-full",
          )}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
