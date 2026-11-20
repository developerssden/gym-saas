import { cn } from "@/lib/utils"

/** Kettlebell mark + wordmark. Colours follow the surrounding theme. */
export function KettlioLogo({ className, size = 30 }: { className?: string; size?: number }) {
    return (
        <span className={cn("flex items-center gap-2.5", className)}>
            <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
                <path
                    d="M10 12 C10 5, 22 5, 22 12"
                    fill="none"
                    className="stroke-foreground"
                    strokeWidth="3"
                    strokeLinecap="round"
                />
                <circle cx="16" cy="20" r="9" className="fill-primary" />
                <rect x="12" y="17" width="8" height="3" rx="1.5" className="fill-background" />
            </svg>
            <span className="font-heading text-[22px] font-extrabold tracking-tight">Kettlio</span>
        </span>
    )
}
