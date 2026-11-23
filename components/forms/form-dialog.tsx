"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type FormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** The fields. Rendered only while open, so state resets each time. */
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  /** "Add expense", "Save changes". */
  submitLabel: string;
  cancelLabel?: string;
  pending?: boolean;
  /** Just looking: one Close button and no submit (wrap the fields in a disabled fieldset). */
  readOnly?: boolean;
  /** Disable submit without showing a spinner. */
  submitDisabled?: boolean;
  className?: string;
};

/**
 * Short forms: a centred dialog on larger screens, a bottom sheet on phones,
 * with Cancel and the submit button always visible.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel,
  cancelLabel = "Cancel",
  pending = false,
  submitDisabled = false,
  readOnly = false,
  className,
}: FormDialogProps) {
  const isMobile = useIsMobile();
  const close = (o: boolean) => {
    if (!o && pending) return;
    onOpenChange(o);
  };

  const buttons = (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-11 md:h-9"
        onClick={() => close(false)}
        disabled={pending}
      >
        {readOnly ? "Close" : cancelLabel}
      </Button>
      {!readOnly && (
      <Button type="submit" className="h-11 md:h-9" loading={pending} disabled={submitDisabled}>
        {submitLabel}
      </Button>
      )}
    </>
  );

  const form = (body: React.ReactNode) => (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending) onSubmit(e);
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      {body}
    </form>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={close} repositionInputs={false}>
        <DrawerContent className={cn("max-h-[92svh]", className)}>
          {open &&
            form(
              <>
                <DrawerHeader className="text-left">
                  <DrawerTitle>{title}</DrawerTitle>
                  {description && <DrawerDescription>{description}</DrawerDescription>}
                </DrawerHeader>
                <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 pb-2">{children}</div>
                <DrawerFooter className={cn("grid border-t border-border", readOnly ? "grid-cols-1" : "grid-cols-2")}>{buttons}</DrawerFooter>
              </>,
            )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className={cn("max-h-[90vh] overflow-y-auto sm:max-w-md", className)}>
        {open &&
          form(
            <>
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                {description && <DialogDescription>{description}</DialogDescription>}
              </DialogHeader>
              <div className="grid gap-4 py-4">{children}</div>
              <DialogFooter>{buttons}</DialogFooter>
            </>,
          )}
      </DialogContent>
    </Dialog>
  );
}
