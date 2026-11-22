"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PERMISSION_PAGES } from "@/lib/staff-permissions";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

/**
 * One block per page: a "can open this page" switch (the view permission)
 * and the actions on that page. Unticking view clears the page's actions;
 * ticking an action also ticks view, since the page has to open first.
 */
export function PermissionMatrix({ value, onChange, disabled }: Props) {
  const selected = new Set(value);

  const setKeys = (keys: string[], on: boolean) => {
    const next = new Set(selected);
    keys.forEach(k => (on ? next.add(k) : next.delete(k)));
    onChange(Array.from(next));
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {PERMISSION_PAGES.map(page => {
        const viewKey = `${page.id}.view`;
        const pageKeys = page.actions.map(a => a.key);
        const otherActions = page.actions.filter(a => a.key !== viewKey);
        const canOpen = selected.has(viewKey);
        const allOn = pageKeys.every(k => selected.has(k));

        return (
          <fieldset key={page.id} className="rounded-lg border p-4" disabled={disabled}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <legend className="font-semibold">{page.label}</legend>
              <button
                type="button"
                className="text-xs text-primary underline-offset-2 hover:underline disabled:opacity-50"
                onClick={() => setKeys(pageKeys, !allOn)}
                disabled={disabled}
              >
                {allOn ? "Clear all" : "Allow all"}
              </button>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id={viewKey}
                checked={canOpen}
                onCheckedChange={checked =>
                  // Without the page, none of its actions make sense.
                  checked ? setKeys([viewKey], true) : setKeys(pageKeys, false)
                }
                disabled={disabled}
              />
              <Label htmlFor={viewKey} className="flex flex-col items-start gap-0.5 font-medium">
                Can open this page
                {page.actions[0]?.description && (
                  <span className="text-xs font-normal text-muted-foreground">
                    {page.actions[0].description}
                  </span>
                )}
              </Label>
            </div>

            {otherActions.length > 0 && (
              <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2">
                {otherActions.map(action => (
                  <div key={action.key} className="flex items-start gap-3">
                    <Checkbox
                      id={action.key}
                      checked={selected.has(action.key)}
                      onCheckedChange={checked =>
                        checked ? setKeys([viewKey, action.key], true) : setKeys([action.key], false)
                      }
                      disabled={disabled}
                    />
                    <Label htmlFor={action.key} className="flex flex-col items-start gap-0.5 font-normal">
                      {action.label}
                      {action.description && (
                        <span className="text-xs text-muted-foreground">{action.description}</span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
