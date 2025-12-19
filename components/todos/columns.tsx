// components/todos/columns.tsx
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, CheckCircle2, Circle, Trash2 } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/getErrorMessage";

export type Todo = {
  id: string;
  title: string;
  description: string;
  is_completed: boolean;
  createdAt: string;
  updatedAt: string;
};

export const columns: ColumnDef<Todo>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "is_completed",
    header: "Status",
    cell: ({ row }) => {
      const isCompleted = row.getValue("is_completed") as boolean;
      return (
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <Circle className="h-4 w-4 text-gray-400" />
          )}
          <span className={isCompleted ? "text-green-600" : "text-gray-600"}>
            {isCompleted ? "Completed" : "Pending"}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => {
      const title = row.getValue("title") as string;
      return <div className="font-medium">{title}</div>;
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => {
      const description = row.getValue("description") as string;
      return (
        <div className="max-w-md truncate" title={description}>
          {description}
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => {
      const date = row.getValue("createdAt") as string;
      return <div>{format(new Date(date), "MMM dd, yyyy")}</div>;
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const todo = row.original;
      const queryClient = useQueryClient();

      const deleteMutation = useMutation({
        mutationFn: async () => {
          await axios.post("/api/todos/deletetodo", { id: todo.id });
        },
        onSuccess: () => {
          toast.success("Todo deleted successfully");
          queryClient.invalidateQueries({ queryKey: ["todos"] });
        },
        onError: (err: unknown) => toast.error(getErrorMessage(err)),
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
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(todo.id)}
            >
              Copy todo ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/todos/manage?action=edit&id=${todo.id}`}>
                Edit todo
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/todos/manage?action=view&id=${todo.id}`}>
                View details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                if (confirm("Are you sure you want to delete this todo?")) {
                  deleteMutation.mutate();
                }
              }}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

