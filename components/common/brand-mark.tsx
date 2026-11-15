import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

// The Kettlio kettlebell symbol, rendered as a CSS mask so it takes the theme's
// primary color (lime in light mode, neon lime in dark mode, and any custom theme).
// Source: public/brand/kettlio-mark.png (594x662, transparent).
const MARK_URL = "url(/brand/kettlio-mark.png)";

const maskStyle: CSSProperties = {
  aspectRatio: "594 / 662",
  maskImage: MARK_URL,
  WebkitMaskImage: MARK_URL,
  maskSize: "contain",
  WebkitMaskSize: "contain",
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
  maskPosition: "center",
  WebkitMaskPosition: "center",
};

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-6 shrink-0 bg-primary", className)}
      style={maskStyle}
    />
  );
}
