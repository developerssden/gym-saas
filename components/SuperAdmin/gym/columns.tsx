/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import type { Gym } from "@/types";
import { ColumnDef } from "@tanstack/react-table";
import { PencilIcon, TrashIcon, CheckCircleIcon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

export const columns: ColumnDef<Gym>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Gym" />,
  },
  {
    id: "owner",
    accessorFn: (row) => `${row.owner?.first_name ?? ""} ${row.owner?.last_name ?? ""}`.trim(),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Owner" />,
    cell: ({ row }) => {
      const o = row.original.owner;
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
    cell: ({ row }) => <ActionCell gym={row.original} />,
  },
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
    <div className="flex gap-2">
      <Link href={`/gyms/manage?action=edit&id=${gym.id}`}>
        <Button size="icon" variant="outline" className="rounded text-blue-600" title="Edit">
          <PencilIcon size={16} />
        </Button>
      </Link>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className="rounded text-red-600 hover:text-red-700 hover:bg-red-50"
            disabled={isDeleting}
            title="Delete"
          >
            <TrashIcon size={16} />
          </Button>
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
            <AlertDialogAction onClick={() => deleteGym()} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button
        size="icon"
        variant="outline"
        onClick={() => toggleActive()}
        disabled={isToggling}
        className={`rounded ${
          gym.is_active
            ? "text-green-500 hover:text-green-600 hover:bg-green-50"
            : "text-gray-400 hover:text-green-500 hover:bg-gray-50"
        }`}
        title={gym.is_active ? "Deactivate" : "Activate"}
      >
        {gym.is_active ? <CheckCircleIcon size={16} /> : <XCircleIcon size={16} />}
      </Button>
    </div>
  );
};


