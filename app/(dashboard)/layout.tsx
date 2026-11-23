import { AppSidebar } from "@/components/layout/app-sidebar";
import { SiteHeader } from "@/components/layout/header";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { AppToaster } from "@/components/layout/app-toaster";
import { SidebarProvider } from "@/components/ui/sidebar";
import { BreadcrumbProvider } from "@/components/layout/breadcrumb-context";
import type { Metadata } from "next";

export const metadata: Metadata = {
  description: "The all-in-one platform for modern gym management.",
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <BreadcrumbProvider>
        <AppSidebar />
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <SiteHeader />
          <div className="flex-1 min-h-0">
            {children}
            <MobileTabBar />
          </div>
          <AppToaster />
        </main>
      </BreadcrumbProvider>
    </SidebarProvider>
  );
}
