"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

export function RequiredLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      <span
        className="size-1.5 rounded-full bg-primary-dim"
        aria-hidden="true"
      />
      <span className="sr-only"> (required)</span>
    </Label>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;
}
