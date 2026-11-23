"use client";

import { useState } from "react";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FormDialog } from "@/components/forms/form-dialog";
import { LabeledField } from "@/components/forms/labeled-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { MAX_TODO_NOTES, MAX_TODO_TITLE, dueDay, validateTodoInput } from "@/lib/todos";

export type TodoRow = {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  is_completed: boolean;
  createdAt: string;
  updatedAt: string;
};

export const invalidateTodos = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ queryKey: ["todos"] });

/** Edit a to-do's text, notes and due date. */
export function TodoDialog({ todo, open, onClose }: { todo: TodoRow; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [due, setDue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTitle(todo.title);
      setNotes(todo.description ?? "");
      setDue(todo.due_date ? dueDay(todo.due_date) : "");
      setSubmitted(false);
    }
  }

  const titleError = validateTodoInput({ title });
  const notesError = validateTodoInput({ description: notes });

  const save = useMutation({
    mutationFn: () =>
      axios.post("/api/todos/updatetodo", { id: todo.id, title: title.trim(), description: notes.trim(), due_date: due || null }),
    onSuccess: () => {
      toast.success("To-do saved");
      invalidateTodos(queryClient);
      onClose();
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Edit to-do"
      onSubmit={() => {
        setSubmitted(true);
        if (!titleError && !notesError) save.mutate();
      }}
      submitLabel="Save changes"
      pending={save.isPending}
    >
      <LabeledField label="To-do" error={submitted ? titleError : null} required>
        {(p) => <Input {...p} maxLength={MAX_TODO_TITLE} value={title} onChange={(e) => setTitle(e.target.value)} className="h-11" />}
      </LabeledField>
      <LabeledField label="Due date (optional)">
        {(p) => <Input {...p} type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-11 w-48" />}
      </LabeledField>
      <LabeledField label="Notes (optional)" error={submitted ? notesError : null}>
        {(p) => (
          <Textarea
            {...p}
            rows={3}
            maxLength={MAX_TODO_NOTES}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything to remember, e.g. call before 5pm"
          />
        )}
      </LabeledField>
    </FormDialog>
  );
}
