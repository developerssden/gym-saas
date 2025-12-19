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

interface SubscriptionLimitModalProps {
  open: boolean
  onClose: () => void
  limitInfo?: {
    current?: number
    max?: number
    resourceType?: string
    locationId?: string
  }
  planName?: string
}

export function SubscriptionLimitModal({
  open,
  onClose,
  limitInfo,
  planName,
}: SubscriptionLimitModalProps) {
  // Provide default values if limitInfo is undefined
  const { current = 0, max = 0, resourceType = "resource" } = limitInfo || {}

  const resourceLabels: Record<string, string> = {
    gym: "Gyms",
    location: "Locations",
    member: "Members",
    equipment: "Equipment/Inventory",
  }

  const resourceLabel = resourceLabels[resourceType] || resourceType

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <DialogTitle>Plan Limit Reached</DialogTitle>
          </div>
          <DialogDescription>
            You have reached your plan limit for {resourceLabel.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Current usage: <span className="font-semibold">{current}</span> /{" "}
              <span className="font-semibold">{max}</span> {resourceLabel.toLowerCase()}
            </p>
            {planName && (
              <p className="text-sm text-muted-foreground">
                Current plan: <span className="font-semibold">{planName}</span>
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-4">
              Please upgrade your plan to add more {resourceLabel.toLowerCase()}.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="default">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

