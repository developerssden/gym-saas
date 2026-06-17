/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import type { Location } from "@/types";
import { ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
} from "@/components/ui/alert-dialog";

export const columns: ColumnDef<Location>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Location" />,
  },
  {
    id: "gym",
    accessorFn: (row) => row.gym?.name ?? "",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Gym" />,
    cell: ({ row }) => row.original.gym?.name ?? "-",
  },
  {
    id: "owner",
    accessorFn: (row) => {
      const o = row.gym?.owner;
      return `${o?.first_name ?? ""} ${o?.last_name ?? ""}`.trim();
    },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Owner" />,
    cell: ({ row }) => {
      const o = row.original.gym?.owner;
      return (
        <div className="flex flex-col">
          <span className="font-medium">
            {o?.first_name || o?.last_name ? `${o?.first_name ?? ""} ${o?.last_name ?? ""}`.trim() : "-"}
          </span>
          <span className="text-xs text-muted-foreground">{o?.email ?? ""}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "city",
    header: ({ column }) => <DataTableColumnHeader column={column} title="City" />,
    cell: ({ row }) => row.original.city ?? "-",
  },
  {
    accessorKey: "country",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Country" />,
    cell: ({ row }) => row.original.country ?? "-",
  },
  {
    accessorKey: "is_active",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Active" />,
    cell: ({ row }) => (row.original.is_active ? "Yes" : "No"),
  },
  {
    id: "actions",
    header: "Actions",
    enableHiding: false,
    cell: ({ row }) => <ActionCell location={row.original} />,
  },
];

const ActionCell = ({ location }: { location: Location }) => {
  const queryClient = useQueryClient();

  const { mutate: deleteLocation, isPending: isDeleting } = useMutation({
    mutationFn: async () => axios.post("/api/locations/deletelocation", { id: location.id }),
    onSuccess: () => {
      toast.success("Location deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["locations"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to delete location");
    },
  });

  const { mutate: toggleActive, isPending: isToggling } = useMutation({
    mutationFn: async () => axios.post("/api/locations/activelocation", { id: location.id }),
    onSuccess: () => {
      toast.success("Location status updated");
      queryClient.invalidateQueries({ queryKey: ["locations"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to update location status");
    },
  });

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
          <Link href={`/locations/manage?action=edit&id=${location.id}`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleActive()} disabled={isToggling}>
          {location.is_active ? (
            <XCircle className="mr-2 h-4 w-4" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          {location.is_active ? "Deactivate" : "Activate"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="text-destructive"
              disabled={isDeleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the location &quot;{location.name}&quot;.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteLocation()} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};


