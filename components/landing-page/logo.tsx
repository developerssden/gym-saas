import { BrandMark } from "@/components/common/brand-mark"
import { APP_NAME } from "@/constants/brand"
import { cn } from "@/lib/utils"

/**
 * Kettlio logo: the kettlebell mark from public/brand/kettlio-mark.png (tinted with
 * the theme's lime via BrandMark) + the wordmark.
 */
export function KettlioLogo({ className, markClassName }: { className?: string; markClassName?: string }) {
    return (
        <span className={cn("flex items-center gap-2", className)}>
            <BrandMark className={cn("h-[30px]", markClassName)} />
            <span className="font-heading text-[22px] font-extrabold tracking-tight">{APP_NAME}</span>
        </span>
    )
}
