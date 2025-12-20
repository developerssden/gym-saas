// components/equipment/columns.tsx
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
import { MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/getErrorMessage";

export type Equipment = {
  id: string;
  name: string;
  type: string;
  quantity: string;
  weight: string | null;
  gym: {
    id: string;
    name: string;
  };
  location: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

// Separate component for actions cell to use hooks
function EquipmentActionsCell({ equipment }: { equipment: Equipment }) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await axios.post("/api/equipment/deleteequipment", { id: equipment.id });
    },
    onSuccess: () => {
      toast.success("Equipment deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
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
          onClick={() => navigator.clipboard.writeText(equipment.id)}
        >
          Copy equipment ID
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/equipment/manage?action=edit&id=${equipment.id}`}>
            Edit equipment
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/equipment/manage?action=view&id=${equipment.id}`}>
            View details
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            if (confirm("Are you sure you want to delete this equipment?")) {
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

export const columns: ColumnDef<Equipment>[] = [
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
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      const name = row.getValue("name") as string;
      return <div className="font-medium">{name}</div>;
    },
  },
  {
    accessorKey: "type",
    header: "Type",
  },
  {
    accessorKey: "quantity",
    header: "Quantity",
  },
  {
    accessorKey: "weight",
    header: "Weight",
    cell: ({ row }) => {
      const weight = row.getValue("weight") as string | null;
      return <div>{weight || "N/A"}</div>;
    },
  },
  {
    accessorKey: "gym.name",
    header: "Gym",
    cell: ({ row }) => {
      const gym = row.original.gym;
      return <div>{gym.name}</div>;
    },
  },
  {
    accessorKey: "location.name",
    header: "Location",
    cell: ({ row }) => {
      const location = row.original.location;
      return <div>{location?.name || "N/A"}</div>;
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const equipment = row.original;
      return <EquipmentActionsCell equipment={equipment} />;
    },
  },
];

