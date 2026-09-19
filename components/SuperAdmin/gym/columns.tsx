/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import type { Gym } from "@/types";
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

const gymColumn: ColumnDef<Gym> = {
  accessorKey: "name",
  header: ({ column }) => <DataTableColumnHeader column={column} title="Gym" />,
  cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
};

const cityColumn: ColumnDef<Gym> = {
  accessorKey: "city",
  header: ({ column }) => <DataTableColumnHeader column={column} title="City" />,
  cell: ({ row }) => row.original.city ?? <span className="text-muted-foreground">—</span>,
};

const activeColumn: ColumnDef<Gym> = {
  accessorKey: "is_active",
  header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
  cell: ({ row }) => {
    const isActive = row.original.is_active;
    return (
      <span
        className={
          isActive
            ? "inline-flex items-center gap-1.5 rounded-full bg-status-active px-2.5 py-1 text-xs font-medium text-status-active-foreground"
            : "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
        }
      >
        <span
          className={
            isActive
              ? "size-1.5 rounded-full bg-status-active-foreground"
              : "size-1.5 rounded-full bg-muted-foreground"
          }
          aria-hidden="true"
        />
        {isActive ? "Active" : "Inactive"}
      </span>
    );
  },
};

const actionsColumn: ColumnDef<Gym> = {
  id: "actions",
  header: "Actions",
  enableHiding: false,
  enableSorting: false,
  cell: ({ row }) => <ActionCell gym={row.original} />,
};

export const superAdminColumns: ColumnDef<Gym>[] = [
  gymColumn,
  {
    id: "owner",
    accessorFn: (row) => `${row.owner?.first_name ?? ""} ${row.owner?.last_name ?? ""}`.trim(),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Owner" />,
    cell: ({ row }) => {
      const owner = row.original.owner;
      const ownerName =
        owner?.first_name || owner?.last_name
          ? `${owner?.first_name ?? ""} ${owner?.last_name ?? ""}`.trim()
          : "—";

      return (
        <div className="flex flex-col">
          <span className="font-medium">{ownerName}</span>
          <span className="text-xs text-muted-foreground">{owner?.email ?? ""}</span>
        </div>
      );
    },
  },
  cityColumn,
  {
    accessorKey: "country",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Country" />,
    cell: ({ row }) => row.original.country ?? <span className="text-muted-foreground">—</span>,
  },
  activeColumn,
  actionsColumn,
];

export const gymOwnerColumns: ColumnDef<Gym>[] = [
  gymColumn,
  cityColumn,
  {
    id: "locations",
    accessorFn: (row) => row._count?.locations ?? 0,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Locations" />,
    cell: ({ row }) => row.original._count?.locations ?? 0,
  },
  {
    id: "members",
    accessorFn: (row) => row._count?.members ?? 0,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Members" />,
    cell: ({ row }) => row.original._count?.members ?? 0,
  },
  activeColumn,
  actionsColumn,
];

const ActionCell = ({ gym }: { gym: Gym }) => {
  const queryClient = useQueryClient();

  const { mutate: deleteGym, isPending: isDeleting } = useMutation({
    mutationFn: async () => axios.post("/api/gyms/deletegym", { id: gym.id }),
    onSuccess: () => {
      toast.success("Gym deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["gyms"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to delete gym");
    },
  });

  const { mutate: toggleActive, isPending: isToggling } = useMutation({
    mutationFn: async () => axios.post("/api/gyms/activegym", { id: gym.id }),
    onSuccess: () => {
      toast.success("Gym status updated");
      queryClient.invalidateQueries({ queryKey: ["gyms"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to update gym status");
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
          <Link href={`/gyms/manage?action=edit&id=${gym.id}`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleActive()} disabled={isToggling}>
          {gym.is_active ? (
            <XCircle className="mr-2 h-4 w-4" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          {gym.is_active ? "Deactivate" : "Activate"}
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
                This action cannot be undone. This will permanently delete the gym &quot;{gym.name}&quot;.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteGym()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};


