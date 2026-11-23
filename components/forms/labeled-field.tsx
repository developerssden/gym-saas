"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Props to spread onto the input so its label, hint and error are announced. */
export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
};

type LabeledFieldProps = {
  label: React.ReactNode;
  /** Help text under the input. */
  hint?: React.ReactNode;
  /** Error under the input; also marks the input invalid. */
  error?: React.ReactNode;
  required?: boolean;
  /** Defaults to a generated id. */
  id?: string;
  className?: string;
  /** Render the input with the given props: {(p) => <Input {...p} />}. */
  children: (control: FieldControlProps) => React.ReactNode;
};

/**
 * A label, its input, a hint and an error, wired together for screen readers
 * (htmlFor, aria-describedby, aria-invalid). Use for every form field.
 */
export function LabeledField({ label, hint, error, required, id, className, children }: LabeledFieldProps) {
  const autoId = React.useId();
  const fieldId = id ?? `field-${autoId}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={fieldId}>
        {label}
        {required && (
          <span aria-hidden className="text-destructive">
            *
          </span>
        )}
      </Label>
      {children({
        id: fieldId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required ? true : undefined,
      })}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
