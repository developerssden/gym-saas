import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Save/Cancel bar for long forms on a page: sticks to the bottom of the screen
 * so the buttons are always in reach. Put it last inside the <form>.
 */
export function StickyFormFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-4 mt-6 flex gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-6 md:justify-end md:px-6",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        "[&>*]:h-11 [&>*]:flex-1 md:[&>*]:h-10 md:[&>*]:flex-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
