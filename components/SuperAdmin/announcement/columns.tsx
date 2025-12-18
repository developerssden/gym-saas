/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import type { Announcement } from "@/types";
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
    <div className="flex gap-2">
      <Link href={`/announcements/manage?action=edit&id=${announcement.id}`}>
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

      <Button
        size="icon"
        variant="outline"
        onClick={() => toggleActive()}
        disabled={isToggling}
        className={`rounded ${
          announcement.is_active
            ? "text-green-500 hover:text-green-600 hover:bg-green-50"
            : "text-gray-400 hover:text-green-500 hover:bg-gray-50"
        }`}
        title={announcement.is_active ? "Deactivate" : "Activate"}
      >
        {announcement.is_active ? <CheckCircleIcon size={16} /> : <XCircleIcon size={16} />}
      </Button>
    </div>
  );
};


