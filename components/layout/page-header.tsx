import * as React from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: React.ReactNode;
  /** One line saying what the page is for. */
  description?: React.ReactNode;
  /** Main page actions ("Add expense"); they stack under the title on phones. */
  actions?: React.ReactNode;
  className?: string;
};

/** Title, one-line description and the page's main actions. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="h1">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap gap-2 [&>*]:h-11 [&>*]:flex-1 sm:[&>*]:flex-none md:[&>*]:h-10">{actions}</div>
      )}
    </div>
  );
}
