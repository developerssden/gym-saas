"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Check, ChevronsUpDown } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type AnnouncementRecipientOption = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string;
};

function recipientLabel(user: AnnouncementRecipientOption) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  if (name && user.email) return `${name} (${user.email})`;
  return name || user.email || user.id;
}

export function AnnouncementRecipientPicker({
  role,
  value,
  onChange,
  disabled,
  selectedRecipient,
}: {
  role: "GYM_OWNER" | "MEMBER";
  value: string;
  onChange: (userId: string) => void;
  disabled?: boolean;
  selectedRecipient?: AnnouncementRecipientOption | null;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery<{ data: AnnouncementRecipientOption[] }>({
    queryKey: ["announcement-recipients", role, debouncedSearch],
    queryFn: async () => {
      const res = await axios.post("/api/announcements/getrecipients", {
        role,
        search: debouncedSearch,
      });
      return res.data;
    },
    enabled: !disabled,
  });

  const users = data?.data ?? [];
  const selected = useMemo(() => {
    return users.find((user) => user.id === value) || selectedRecipient || null;
  }, [users, value, selectedRecipient]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between"
        >
          <span className="truncate">
            {selected
              ? recipientLabel(selected)
              : role === "GYM_OWNER"
                ? "Select a gym owner..."
                : "Select a member..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name or email..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Loading..." : "No matching users."}
            </CommandEmpty>
            <CommandGroup>
              {users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={user.id}
                  onSelect={() => {
                    onChange(user.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === user.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {recipientLabel(user)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
