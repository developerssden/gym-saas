import { PageBackButton } from "./page-back-button"

export const PageContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="p-4 w-full h-full">
      <PageBackButton />
      {children}
    </div>
  )
}
