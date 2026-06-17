/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import type { Announcement } from "@/types";
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

const truncate = (value: unknown, max = 80) => {
  const s = String(value ?? "");
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
};

export const columns: ColumnDef<Announcement>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
    cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
  },
  {
    accessorKey: "audience",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Audience" />,
    cell: ({ row }) => row.original.audience,
  },
  {
    accessorKey: "message",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Message" />,
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{truncate(row.original.message)}</span>,
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
    cell: ({ row }) => <ActionCell announcement={row.original} />,
  },
];

const ActionCell = ({ announcement }: { announcement: Announcement }) => {
  const queryClient = useQueryClient();

  const { mutate: deleteAnnouncement, isPending: isDeleting } = useMutation({
    mutationFn: async () => axios.post("/api/announcements/deleteannouncement", { id: announcement.id }),
    onSuccess: () => {
      toast.success("Announcement deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to delete announcement");
    },
  });

  const { mutate: toggleActive, isPending: isToggling } = useMutation({
    mutationFn: async () => axios.post("/api/announcements/activeannouncement", { id: announcement.id }),
    onSuccess: () => {
      toast.success("Announcement status updated");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to update announcement status");
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
          <Link href={`/announcements/manage?action=edit&id=${announcement.id}`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleActive()} disabled={isToggling}>
          {announcement.is_active ? (
            <XCircle className="mr-2 h-4 w-4" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          {announcement.is_active ? "Deactivate" : "Activate"}
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
                This action cannot be undone. This will permanently delete the announcement &quot;{announcement.title}&quot;.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteAnnouncement()} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};


