"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
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

export type ClassRow = {
  id: string;
  name: string;
  category: string;
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  capacity: number | null;
  location: { id: string; name: string } | null;
  instructor: { id: string; first_name: string; last_name: string | null } | null;
};

export const CATEGORY_LABELS: Record<string, string> = {
  YOGA: "Yoga",
  SPA: "Spa",
  FITNESS: "Fitness",
  MARTIAL_ARTS: "Martial arts",
  DANCE: "Dance",
  OTHER: "Other",
};

export const DAY_LABELS: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

function ClassActionsCell({ gymClass }: { gymClass: ClassRow }) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await axios.post("/api/classes/deleteclass", { id: gymClass.id });
    },
    onSuccess: () => {
      toast.success("Class deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["classes"] });
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
          <Link href={`/classes/attendance?class_id=${gymClass.id}`}>Take attendance</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/classes/manage?action=edit&id=${gymClass.id}`}>Edit class</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/classes/manage?action=view&id=${gymClass.id}`}>View details</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            if (confirm("Are you sure you want to delete this class?")) {
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

export const columns: ColumnDef<ClassRow>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => CATEGORY_LABELS[row.original.category] || row.original.category,
  },
  {
    accessorKey: "day_of_week",
    header: "Day",
    cell: ({ row }) =>
      row.original.day_of_week ? DAY_LABELS[row.original.day_of_week] : "—",
  },
  {
    accessorKey: "start_time",
    header: "Time",
    cell: ({ row }) => {
      const { start_time, end_time } = row.original;
      if (!start_time && !end_time) return "—";
      return `${start_time || "?"}–${end_time || "?"}`;
    },
  },
  {
    accessorKey: "instructor",
    header: "Instructor",
    cell: ({ row }) => {
      const i = row.original.instructor;
      return i ? `${i.first_name} ${i.last_name ?? ""}`.trim() : "—";
    },
  },
  {
    accessorKey: "location.name",
    header: "Location",
    cell: ({ row }) => row.original.location?.name || "Gym-wide",
  },
  {
    accessorKey: "capacity",
    header: "Capacity",
    cell: ({ row }) => row.original.capacity ?? "—",
  },
  {
    id: "actions",
    header: "Actions",
    enableHiding: false,
    cell: ({ row }) => <ClassActionsCell gymClass={row.original} />,
  },
];
