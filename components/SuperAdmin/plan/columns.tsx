/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { Button } from "@/components/ui/button"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Plan } from "@/types"
import { ColumnDef } from "@tanstack/react-table"
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import Link from "next/link"
import axios from "axios"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
export const columns: ColumnDef<Plan>[] = [
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
    accessorKey: "max_locations",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Max Locations" />
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
    enableHiding: false,
    cell: ({ row }) => <ActionCell subscription={row.original} />,
  },
]

const ActionCell = ({ subscription }: { subscription: Plan }) => {
  const queryClient = useQueryClient()

  const { mutate: deleteSubscription } = useMutation({
    mutationFn: async () => {
      await axios.post("/api/plans/deleteplan", { id: subscription.id })
    },
    onSuccess: () => {
      toast.success("Plan deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["plans"] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete plan")
    },
  })

  const { mutate: toggleActive } = useMutation({
    mutationFn: async () => {
      await axios.post("/api/plans/activeplan", { id: subscription.id })
    },
    onSuccess: (data: any) => { // data is response from axios? No, axios returns object. mutationFn returns void above, wait.
      // Let's fix mutationFn to return data so we can use it, or just use message from toast.
      // actually axios.post returns a promise that resolves to response.
      // Let's check api response. "message" and "plan".
      toast.success("Plan status updated")
      queryClient.invalidateQueries({ queryKey: ["plans"] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update plan status")
    },
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/plans/manage?action=edit&id=${subscription.id}`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleActive()}>
          {subscription.is_active ? (
            <XCircle className="mr-2 h-4 w-4" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          {subscription.is_active ? "Deactivate" : "Activate"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the plan "{subscription.name}".
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
