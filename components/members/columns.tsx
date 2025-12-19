"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/getErrorMessage";

type Member = {
  id: string;
  user: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone_number: string;
  };
  gym: {
    id: string;
    name: string;
  };
  location: {
    id: string;
    name: string;
  };
  joinedAt: string;
};

export const columns: ColumnDef<Member>[] = [
  {
    accessorKey: "user.first_name",
    header: "Name",
    cell: ({ row }) => {
      const member = row.original;
      return `${member.user.first_name} ${member.user.last_name}`;
    },
  },
  {
    accessorKey: "user.email",
    header: "Email",
    cell: ({ row }) => row.original.user.email || "-",
  },
  {
    accessorKey: "user.phone_number",
    header: "Phone",
    cell: ({ row }) => row.original.user.phone_number || "-",
  },
  {
    accessorKey: "gym.name",
    header: "Gym",
    cell: ({ row }) => row.original.gym.name,
  },
  {
    accessorKey: "location.name",
    header: "Location",
    cell: ({ row }) => row.original.location.name,
  },
  {
    accessorKey: "joinedAt",
    header: "Joined Date",
    cell: ({ row }) => {
      const date = new Date(row.original.joinedAt);
      return date.toLocaleDateString();
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const member = row.original;
      const queryClient = useQueryClient();

      const deleteMutation = useMutation({
        mutationFn: async () => {
          await axios.post("/api/members/deletemember", { id: member.id });
        },
        onSuccess: () => {
          toast.success("Member deleted successfully");
          queryClient.invalidateQueries({ queryKey: ["members"] });
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
            <DropdownMenuItem asChild>
              <Link href={`/members/manage?action=edit&id=${member.id}`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (confirm("Are you sure you want to delete this member?")) {
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

