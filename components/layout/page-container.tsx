import { PageBackButton } from "./page-back-button"
import { cn } from "@/lib/utils"

/** Page padding and a max width so lists and forms don't stretch on wide screens. */
export const PageContainer = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={cn("mx-auto h-full w-full max-w-7xl p-4 md:p-6", className)}>
      <PageBackButton />
      {children}
    </div>
  )
}
