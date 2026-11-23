"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type RowAction = {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  /** Navigate instead of running onClick. */
  href?: string;
  /** Red, and always in the "More" menu after a separator. */
  destructive?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Leave out (e.g. no permission). Hidden actions are dropped. */
  hidden?: boolean;
};

type RowActionsProps = {
  /** Most important first. The first `visible` non-destructive ones get buttons. */
  actions: RowAction[];
  /** How many get a visible button (max 2 per the design rules). */
  visible?: 0 | 1 | 2;
  /** Extra menu items that aren't simple actions (e.g. a WhatsApp share item). */
  moreItems?: React.ReactNode;
  className?: string;
  /** Accessible name for the "More" button, e.g. "More actions for Ali Khan". */
  moreLabel?: string;
};

/**
 * Up to two labelled buttons (44px on phones) plus a "More" menu for the rest.
 * Clicks don't bubble, so it's safe inside a tappable row or card.
 */
export function RowActions({ actions, visible = 2, moreItems, className, moreLabel = "More actions" }: RowActionsProps) {
  const shown = actions.filter(a => !a.hidden);
  const primary = shown.filter(a => !a.destructive).slice(0, visible);
  const rest = shown.filter(a => !primary.includes(a));
  const restNormal = rest.filter(a => !a.destructive);
  const restDestructive = rest.filter(a => a.destructive);
  const hasMore = rest.length > 0 || !!moreItems;

  if (primary.length === 0 && !hasMore) return null;

  return (
    <div
      className={cn("flex items-center justify-end gap-2", className)}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
    >
      {primary.map(action => {
        const Icon = action.icon;
        const content = (
          <>
            {Icon && <Icon aria-hidden />}
            {action.label}
          </>
        );
        return action.href && !action.disabled ? (
          <Button key={action.label} asChild variant="outline" className="h-11 md:h-9">
            <Link href={action.href}>{content}</Link>
          </Button>
        ) : (
          <Button
            key={action.label}
            variant="outline"
            className="h-11 md:h-9"
            onClick={action.onClick}
            disabled={action.disabled}
            loading={action.loading}
          >
            {content}
          </Button>
        );
      })}

      {hasMore && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="size-11 p-0 md:size-9" aria-label={moreLabel}>
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {restNormal.map(action => (
              <MenuAction key={action.label} action={action} />
            ))}
            {moreItems}
            {restDestructive.length > 0 && (restNormal.length > 0 || moreItems) && <DropdownMenuSeparator />}
            {restDestructive.map(action => (
              <MenuAction key={action.label} action={action} />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function MenuAction({ action }: { action: RowAction }) {
  const Icon = action.icon;
  const className = cn("min-h-11 md:min-h-8", action.destructive && "text-destructive focus:text-destructive");
  const content = (
    <>
      {Icon && <Icon aria-hidden className={cn("mr-2 size-4", action.destructive && "text-destructive")} />}
      {action.label}
    </>
  );
  if (action.href && !action.disabled) {
    return (
      <DropdownMenuItem asChild className={className}>
        <Link href={action.href}>{content}</Link>
      </DropdownMenuItem>
    );
  }
  return (
    <DropdownMenuItem className={className} disabled={action.disabled || action.loading} onClick={action.onClick}>
      {content}
    </DropdownMenuItem>
  );
}
