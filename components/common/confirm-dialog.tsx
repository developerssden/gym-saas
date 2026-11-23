"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export type ConfirmOptions = {
  /** A question: "Delete this member?" */
  title: string;
  /** What happens if they go ahead, in plain words. */
  description: React.ReactNode;
  /** Verb for the button: "Delete", "Deactivate". Defaults to "Confirm". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red button for things that remove or stop something. */
  destructive?: boolean;
};

type ConfirmDialogProps = ConfirmOptions & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** May return a promise: the dialog shows a spinner, closes when it resolves and stays open if it rejects. */
  onConfirm: () => unknown | Promise<unknown>;
  /** Show the spinner from outside (e.g. a mutation's isPending). */
  pending?: boolean;
};

/**
 * Asks before doing something that can't be undone and says what will happen.
 * Use instead of the browser's confirm().
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
}: ConfirmDialogProps) {
  const [running, setRunning] = React.useState(false);
  const busy = running || !!pending;

  const handleConfirm = async () => {
    setRunning(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Stay open so they can retry; the caller shows the error (e.g. a toast in onError).
    } finally {
      setRunning(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={o => !busy && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} className="h-11 sm:h-9">
            {cancelLabel}
          </AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            loading={busy}
            className="h-11 sm:h-9"
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Promise-style confirmation for event handlers:
 *
 *   const { confirm, dialog } = useConfirm();
 *   if (await confirm({ title: "Delete this member?", description: "…", destructive: true })) remove();
 *   return <>{dialog}…</>;
 */
export function useConfirm() {
  const [state, setState] = React.useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = React.useCallback(
    (options: ConfirmOptions) => new Promise<boolean>(resolve => setState({ ...options, resolve })),
    [],
  );

  const dialog = state ? (
    <ConfirmDialog
      {...state}
      open
      onOpenChange={open => {
        if (!open) {
          state.resolve(false);
          setState(null);
        }
      }}
      onConfirm={() => {
        state.resolve(true);
        setState(null);
      }}
    />
  ) : null;

  return { confirm, dialog };
}
