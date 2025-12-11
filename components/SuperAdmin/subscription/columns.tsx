/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { Button } from "@/components/ui/button"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Subscription } from "@/types"
import { ColumnDef } from "@tanstack/react-table"
import { PencilIcon, TrashIcon, CheckCircleIcon, XCircleIcon } from "lucide-react"
import Link from "next/link"
import axios from "axios"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"



// Column definitions for TanStack table
export const columns: ColumnDef<Subscription>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: "monthly_price",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Monthly Price" />
    ),
    cell: info => `$${info.getValue<number>()}`,
  },
  {
    accessorKey: "yearly_price",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Yearly Price" />
    ),
    cell: info => `$${info.getValue<number>()}`,
  },
  {
    accessorKey: "max_gyms",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Max Gyms" />
    ),
  },
  {
    accessorKey: "max_members",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Max Members" />
    ),
  },
  {
    accessorKey: "max_equipment",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Max Equipment" />
    ),
  },
  {
    accessorKey: "is_active",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Active" />
    ),
    cell: info => (info.getValue<boolean>() ? "Yes" : "No"),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <ActionCell subscription={row.original} />,
  },
]

const ActionCell = ({ subscription }: { subscription: Subscription }) => {
  const queryClient = useQueryClient()

  const { mutate: deleteSubscription } = useMutation({
    mutationFn: async () => {
      await axios.post("/api/subscription/deletesubscription", { id: subscription.id })
    },
    onSuccess: () => {
      toast.success("Subscription deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete subscription")
    },
  })

  const { mutate: toggleActive } = useMutation({
    mutationFn: async () => {
      await axios.post("/api/subscription/activesubscription", { id: subscription.id })
    },
    onSuccess: (data: any) => { // data is response from axios? No, axios returns object. mutationFn returns void above, wait.
      // Let's fix mutationFn to return data so we can use it, or just use message from toast.
      // actually axios.post returns a promise that resolves to response.
      // Let's check api response. "message" and "subscription".
      toast.success("Subscription status updated")
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update subscription status")
    },
  })

  return (
    <div className="flex gap-2">
      {/* Edit Button */}
      <Link href={`/subscriptions/manage?action=edit&id=${subscription.id}`}>
        <Button
          size="icon"
          variant="outline"
          className="rounded text-blue-600"
        >
          <PencilIcon size={16} />
        </Button>
      </Link>

      {/* Delete Button */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className="rounded text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <TrashIcon size={16} />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the subscription "{subscription.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteSubscription()} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toggle Active */}
      <Button
        size="icon"
        variant="outline"
        onClick={() => toggleActive()}
        className={`rounded ${subscription.is_active ? "text-green-500 hover:text-green-600 hover:bg-green-50" : "text-gray-400 hover:text-green-500 hover:bg-gray-50"
          }`}
        title={subscription.is_active ? "Deactivate" : "Activate"}
      >
        {subscription.is_active ? <CheckCircleIcon size={16} /> : <XCircleIcon size={16} />}
      </Button>
    </div>
  )
}
