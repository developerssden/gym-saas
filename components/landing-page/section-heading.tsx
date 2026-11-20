import { cn } from "@/lib/utils"

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("text-sm font-bold uppercase tracking-[0.08em] text-primary-dim dark:text-primary", className)}>
            {children}
        </div>
    )
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <h2
            className={cn(
                "font-heading text-[clamp(30px,3.8vw,48px)] font-extrabold leading-[1.06] tracking-[-0.03em]",
                className
            )}
        >
            {children}
        </h2>
    )
}
