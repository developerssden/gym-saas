"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import Link from "next/link"

interface SubscriptionExpiredModalProps {
  open: boolean
  onClose: () => void
}

export function SubscriptionExpiredModal({
  open,
  onClose,
}: SubscriptionExpiredModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <DialogTitle>Subscription Expired</DialogTitle>
          </div>
          <DialogDescription>
            Your subscription has expired. Please renew to continue using all features.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Your subscription has expired and you need to renew it to access all features.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Please contact the administrator to renew your subscription.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
          <Button asChild>
            <Link href="/subscriptions" onClick={onClose}>
              View Subscriptions
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

