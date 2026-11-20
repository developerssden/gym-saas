import { MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export function WhatsAppIcon({ className }: { className?: string }) {
    return <MessageCircle aria-hidden="true" className={cn("size-[18px] text-green-600 dark:text-green-400", className)} />
}
