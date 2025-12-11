/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { Button } from "@/components/ui/button"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Client } from "@/types"
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
export const columns: ColumnDef<Client>[] = [
    {
        accessorKey: "first_name",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="First Name" />
        ),
    },
    {
        accessorKey: "last_name",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Last Name" />
        ),
    },
    {
        accessorKey: "phone_number",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Phone Number" />
        ),
    },
    {
        accessorKey: "address",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Address" />
        ),
    },
    {
        accessorKey: "city",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="City" />
        ),
    },
    {
        accessorKey: "state",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="State" />
        ),
    },
    {
        accessorKey: "zip_code",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Zip Code" />
        ),
    },
    {
        accessorKey: "date_of_birth",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Date of Birth" />
        ),
    },
    {
        accessorKey: "gender",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Gender" />
        ),
    },
    {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => <ActionCell client={row.original} />,
    },
]

const ActionCell = ({ client }: { client: Client }) => {
    const queryClient = useQueryClient()

    const { mutate: deleteClient } = useMutation({
        mutationFn: async () => {
            await axios.post("/api/client/deleteclient", { id: client.id })
        },
        onSuccess: () => {
            toast.success("Client deleted successfully")
            queryClient.invalidateQueries({ queryKey: ["clients"] })
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || "Failed to delete client")
        },
    })

    const { mutate: toggleActive } = useMutation({
        mutationFn: async () => {
            await axios.post("/api/client/activeclient", { id: client.id })
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
            <Link href={`/clients/manage?action=edit&id=${client.id}`}>
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
                            This action cannot be undone. This will permanently delete the client "{client.first_name} {client.last_name}".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteClient()} className="bg-red-600 hover:bg-red-700">
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
                className={`rounded ${client.is_active ? "text-green-500 hover:text-green-600 hover:bg-green-50" : "text-gray-400 hover:text-green-500 hover:bg-gray-50"
                    }`}
                title={client.is_active ? "Deactivate" : "Activate"}
            >
                {client.is_active ? <CheckCircleIcon size={16} /> : <XCircleIcon size={16} />}
            </Button>
        </div>
    )
}
