"use client"

import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageContainer } from "@/components/layout/page-container"

export default function UnauthorizedPage() {
  return (
    <PageContainer>
    <main className="min-h-[90vh] flex items-center justify-center bg-background">
      <div className="max-w-md w-full text-center space-y-6">
        {/* <CHANGE> Added error icon and 401 status code */}
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle className="w-12 h-12 text-destructive" />
          </div>
        </div>

        {/* <CHANGE> Main error heading and status code */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">401</h1>
          <h2 className="text-2xl font-semibold text-foreground">Unauthorized</h2>
        </div>

        {/* <CHANGE> Error description message */}
        <p className="text-muted-foreground text-base leading-relaxed">
          You don't have permission to access this resource. Please check your credentials and try again.
        </p>

        {/* <CHANGE> Call-to-action buttons */}
        <div className="flex flex-col gap-3 pt-4">
          <Link href="/dashboard">
            <Button className="w-full" variant="default">
              Go to Homepage
            </Button>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="w-full px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
          >
            Go Back
          </button>
        </div>

        {/* <CHANGE> Help text for additional support */}
        <p className="text-sm text-muted-foreground pt-4">
          If you believe this is a mistake, please{" "}
          <Link href="mailto:developerssden@gmail.com" className="text-primary hover:underline">
            contact support
          </Link>
        </p>
        </div>
      </main>
    </PageContainer>
  )
}
