"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type ListCardProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Badge or short status, top right. */
  status?: React.ReactNode;
  /** Prominent value under the status, e.g. an amount. */
  value?: React.ReactNode;
  /** Small extra lines (location, note, recorded by). */
  meta?: React.ReactNode;
  /** RowActions or buttons, shown along the bottom. */
  actions?: React.ReactNode;
  /** Whole card opens this page. */
  href?: string;
  onClick?: () => void;
  className?: string;
};

/**
 * One row of a list on a phone: title, subtitle, status and the main actions.
 * Pass it to DataTable's `mobileCard`. With `href` or `onClick` the whole card is tappable.
 */
export function ListCard({ title, subtitle, status, value, meta, actions, href, onClick, className }: ListCardProps) {
  const tappable = !!href || !!onClick;
  const body = (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-foreground">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</div>}
        {meta && <div className="mt-1 text-xs text-muted-foreground">{meta}</div>}
      </div>
      {(status || value) && (
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          {status}
          {value && <div className="font-semibold text-foreground">{value}</div>}
        </div>
      )}
      {tappable && <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
    </div>
  );

  return (
    <li className={cn("relative border-b border-border last:border-b-0", className)}>
      {href ? (
        <Link href={href} className="block p-4 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted">
          {body}
        </Link>
      ) : onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="block w-full p-4 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted"
        >
          {body}
        </button>
      ) : (
        <div className="p-4">{body}</div>
      )}
      {actions && <div className={cn("px-4 pb-4", tappable && "-mt-1")}>{actions}</div>}
    </li>
  );
}
