/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Subscription } from "@/types"
import { ColumnDef } from "@tanstack/react-table"
import { PencilIcon, TrashIcon, CheckCircleIcon, XCircleIcon } from "lucide-react"



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
    cell: ({ row }) => {
      const subscription = row.original

      return (
        <div className="flex gap-2">
          {/* Edit Button */}
          <button
            onClick={() => console.log("Edit", subscription.id)}
            className="p-1 rounded bg-blue-500 text-white hover:bg-blue-600"
          >
            <PencilIcon size={16} />
          </button>

          {/* Delete Button */}
          <button
            onClick={() => console.log("Delete", subscription.id)}
            className="p-1 rounded bg-red-500 text-white hover:bg-red-600"
          >
            <TrashIcon size={16} />
          </button>

          {/* Toggle Active */}
          <button
            onClick={() => console.log("Toggle Active", subscription.id)}
            className={`p-1 rounded ${subscription.is_active ? "bg-green-500 hover:bg-green-600" : "bg-gray-400 hover:bg-gray-500"
              } text-white`}
          >
            {subscription.is_active ? <CheckCircleIcon size={16} /> : <XCircleIcon size={16} />}
          </button>
        </div>
      )
    },
  },
]
