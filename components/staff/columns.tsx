"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/getErrorMessage";

export type StaffRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  role: string;
  specialization: string | null;
  phone_number: string | null;
  email: string | null;
  shift_notes: string | null;
  gym: { id: string; name: string };
  location: { id: string; name: string } | null;
};

const ROLE_LABELS: Record<string, string> = {
  MANAGER: "Manager",
  TRAINER: "Trainer",
  INSTRUCTOR: "Instructor",
  FRONT_DESK: "Front desk",
  MAINTENANCE: "Maintenance",
  OTHER: "Other",
};

function StaffActionsCell({ staff }: { staff: StaffRow }) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await axios.post("/api/staff/deletestaff", { id: staff.id });
    },
    onSuccess: () => {
      toast.success("Staff deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
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
          <Link href={`/staff/manage?action=edit&id=${staff.id}`}>Edit staff</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/staff/manage?action=view&id=${staff.id}`}>View details</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            if (confirm("Are you sure you want to delete this staff member?")) {
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
}

export const columns: ColumnDef<StaffRow>[] = [
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
    accessorKey: "first_name",
    header: "Name",
    cell: ({ row }) => {
      const s = row.original;
      return (
        <div className="font-medium">
          {`${s.first_name} ${s.last_name ?? ""}`.trim()}
        </div>
      );
    },
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => ROLE_LABELS[row.original.role] || row.original.role,
  },
  {
    accessorKey: "specialization",
    header: "Specialization",
    cell: ({ row }) => row.original.specialization || "—",
  },
  {
    accessorKey: "location.name",
    header: "Location",
    cell: ({ row }) => row.original.location?.name || "Gym-wide",
  },
  {
    accessorKey: "phone_number",
    header: "Contact",
    cell: ({ row }) => row.original.phone_number || row.original.email || "—",
  },
  {
    accessorKey: "shift_notes",
    header: "Shift",
    cell: ({ row }) => (
      <div className="max-w-[200px] truncate">{row.original.shift_notes || "—"}</div>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    enableHiding: false,
    cell: ({ row }) => <StaffActionsCell staff={row.original} />,
  },
];
