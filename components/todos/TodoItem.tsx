"use client";

// One to-do: tap the circle to mark it done (or not done), the rest is in "More".
import { useState } from "react";
import axios from "axios";
import { Check, Pencil, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RowActions } from "@/components/common/row-actions";
import { useConfirm } from "@/components/common/confirm-dialog";
import { TodoDialog, invalidateTodos, type TodoRow } from "@/components/todos/TodoDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { dueState, dueText } from "@/lib/todos";
import { cn } from "@/lib/utils";

export function TodoItem({ todo }: { todo: TodoRow }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [editing, setEditing] = useState(false);
  const canEdit = can("todos.edit");
  const canDelete = can("todos.delete");

  const toggle = useMutation({
    mutationFn: (done: boolean) => axios.post("/api/todos/updatetodo", { id: todo.id, is_completed: done }),
    onSuccess: (_res, done) => {
      invalidateTodos(queryClient);
      if (done) {
        // Not toggle.mutate: by now this row has usually moved to the (collapsed) done list.
        const undo = () =>
          axios
            .post("/api/todos/updatetodo", { id: todo.id, is_completed: false })
            .then(() => invalidateTodos(queryClient))
            .catch((err: unknown) => toast.error(getErrorMessage(err)));
        toast.success(`Done: ${todo.title}`, { action: { label: "Undo", onClick: () => void undo() } });
      }
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: () => axios.post("/api/todos/deletetodo", { id: todo.id }),
    onSuccess: () => {
      toast.success(`Deleted "${todo.title}"`);
      invalidateTodos(queryClient);
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  // Show the new state straight away while it saves.
  const done = toggle.isPending ? !!toggle.variables : todo.is_completed;
  const state = todo.due_date && !done ? dueState(todo.due_date) : null;

  return (
    <li className="flex items-start gap-1 border-b border-border py-1 last:border-b-0">
      {confirmDialog}
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${done ? "Mark not done" : "Mark done"}: ${todo.title}`}
        disabled={!canEdit || toggle.isPending}
        onClick={() => toggle.mutate(!done)}
        className="flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default"
      >
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full border-2 transition-colors",
            done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50 hover:border-primary"
          )}
        >
          {done && <Check aria-hidden className="size-4" strokeWidth={3} />}
        </span>
      </button>

      <div className="min-w-0 flex-1 py-2.5">
        <p className={cn("break-words", done && "text-muted-foreground line-through")}>{todo.title}</p>
        {todo.description && <p className="mt-0.5 break-words text-sm text-muted-foreground">{todo.description}</p>}
        {todo.due_date && !done && (
          <p
            className={cn(
              "mt-0.5 text-xs",
              state === "overdue" && "font-medium text-destructive",
              state === "today" && "font-medium text-amber-800 dark:text-amber-300",
              (state === "tomorrow" || state === "later") && "text-muted-foreground"
            )}
          >
            {dueText(todo.due_date)}
          </p>
        )}
      </div>

      <RowActions
        visible={0}
        className="pt-0.5"
        moreLabel={`More actions for ${todo.title}`}
        actions={[
          { label: "Edit", icon: Pencil, onClick: () => setEditing(true), hidden: !canEdit },
          {
            label: "Delete",
            icon: Trash2,
            destructive: true,
            hidden: !canDelete,
            onClick: async () => {
              const ok = await confirm({
                title: "Delete this to-do?",
                description: `"${todo.title}" is removed from the list. This can't be undone.`,
                confirmLabel: "Delete to-do",
                destructive: true,
              });
              if (ok) remove.mutate();
            },
          },
        ]}
      />
      {canEdit && <TodoDialog todo={todo} open={editing} onClose={() => setEditing(false)} />}
    </li>
  );
}
