"use client";

import { useRef, useState } from "react";
import axios from "axios";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import DataFetchError from "@/components/common/DataFetchError";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TodoItem } from "@/components/todos/TodoItem";
import { invalidateTodos, type TodoRow } from "@/components/todos/TodoDialog";
import { useDebounce } from "@/hooks/use-debounce";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { MAX_TODO_TITLE } from "@/lib/todos";
import { cn } from "@/lib/utils";

type TodosResponse = { data: TodoRow[]; openCount: number; doneCount: number };

/** Add a to-do in one line, with an optional due date. */
function QuickAdd() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  const add = useMutation({
    mutationFn: () => axios.post("/api/todos/createtodo", { title: title.trim(), due_date: due || null }),
    onSuccess: () => {
      setTitle("");
      setDue("");
      invalidateTodos(queryClient);
      // Ready for the next one.
      inputRef.current?.focus();
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  return (
    <form
      className="mb-6 flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim() && !add.isPending) add.mutate();
      }}
    >
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={MAX_TODO_TITLE}
        placeholder="Add a to-do, e.g. Fix the treadmill belt"
        aria-label="New to-do"
        className="h-11 flex-1"
      />
      <div className="flex gap-2">
        <Input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          aria-label="Due date (optional)"
          title="Due date (optional)"
          className={cn("h-11 flex-1 sm:w-40 sm:flex-none", !due && "text-muted-foreground")}
        />
        <Button type="submit" className="h-11" disabled={!title.trim()} loading={add.isPending}>
          {!add.isPending && <Plus aria-hidden />} Add
        </Button>
      </div>
    </form>
  );
}

const TodosPage = () => {
  const { data: session, status } = useSession({ required: true });
  const { can } = usePermissions();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400).trim();
  const [showDone, setShowDone] = useState(false);
  const allowed = status === "authenticated" && (session?.user?.role === "GYM_OWNER" || session?.user?.role === "STAFF");

  const fetchTodos = (which: "open" | "done") => async () =>
    (await axios.post<TodosResponse>("/api/todos/gettodos", { status: which, search: debouncedSearch || undefined })).data;

  const open = useQuery({
    queryKey: ["todos", "open", debouncedSearch],
    queryFn: fetchTodos("open"),
    placeholderData: keepPreviousData,
    enabled: allowed,
  });
  const done = useQuery({
    queryKey: ["todos", "done", debouncedSearch],
    queryFn: fetchTodos("done"),
    placeholderData: keepPreviousData,
    // Only load the done list once it's opened.
    enabled: allowed && showDone,
  });

  if (status === "loading") {
    return (
      <PageContainer>
        <Skeleton className="mb-6 h-9 w-48" />
        <Skeleton className="h-64 w-full" />
      </PageContainer>
    );
  }
  if (session?.user?.role !== "GYM_OWNER" && session?.user?.role !== "STAFF") return redirect("/unauthorized");

  const openTodos = open.data?.data ?? [];
  const doneCount = open.data?.doneCount ?? 0;
  const hasAny = (open.data?.openCount ?? 0) + doneCount > 0;
  const searching = !!debouncedSearch;

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="To-dos" description="Jobs to remember for the gym. Tap the circle when it's done." />

      {can("todos.create") && <QuickAdd />}

      {(hasAny || searching) && (
        <div className="relative mb-3">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search to-dos"
            aria-label="Search to-dos"
            className="h-11 pl-9 md:h-9"
          />
        </div>
      )}

      {open.error ? (
        <DataFetchError error={open.error} onRetry={() => open.refetch()} message="Couldn't load to-dos" />
      ) : open.isLoading && !open.data ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          {openTodos.length > 0 ? (
            <ul aria-label="To do" className={cn("rounded-lg border px-2", open.isFetching && "opacity-80")}>
              {openTodos.map((t) => (
                <TodoItem key={t.id} todo={t} />
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="font-medium">
                {searching ? "No results match your search." : hasAny ? "All done!" : "No to-dos yet"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {searching
                  ? "Try another word from the to-do or its notes."
                  : hasAny
                    ? "Nothing left to do. Nice work."
                    : "Write jobs here so nothing is forgotten, e.g. pay the electricity bill or order towels."}
              </p>
            </div>
          )}

          {doneCount > 0 && (
            <div className="mt-6">
              <button
                type="button"
                aria-expanded={showDone}
                aria-controls="todos-done"
                onClick={() => setShowDone((s) => !s)}
                className="-mx-2 flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronDown aria-hidden className={cn("size-4 transition-transform", showDone && "rotate-180")} />
                Completed ({doneCount})
              </button>
              {showDone && (
                <div id="todos-done" className="mt-2">
                  {done.error ? (
                    <DataFetchError error={done.error} onRetry={() => done.refetch()} message="Couldn't load completed to-dos" />
                  ) : !done.data ? (
                    <Skeleton className="h-12 w-full" />
                  ) : (
                    <ul aria-label="Completed" className="rounded-lg border px-2">
                      {done.data.data.map((t) => (
                        <TodoItem key={t.id} todo={t} />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
};

export default TodosPage;
