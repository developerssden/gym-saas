"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import type { CrumbEntity } from "@/lib/navigation";

type Ctx = { entity: CrumbEntity | null; setEntity: (entity: CrumbEntity | null) => void };

const BreadcrumbContext = React.createContext<Ctx>({ entity: null, setEntity: () => {} });

/** Lets a page tell the header breadcrumb whose page it is ("Ali Khan"). */
export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<{ path: string; entity: CrumbEntity | null }>({ path: "", entity: null });
  const pathname = usePathname() || "/";
  // A name set on another page never leaks onto this one.
  const entity = state.path === pathname ? state.entity : null;
  const setEntity = React.useCallback((e: CrumbEntity | null) => setState({ path: pathname, entity: e }), [pathname]);
  const value = React.useMemo(() => ({ entity, setEntity }), [entity, setEntity]);
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

export function useBreadcrumbEntity(): CrumbEntity | null {
  return React.useContext(BreadcrumbContext).entity;
}

/** Call from a page once its record has loaded: useNameBreadcrumb(member && { label: name, href }). */
export function useNameBreadcrumb(entity: CrumbEntity | null | undefined | false) {
  const { setEntity } = React.useContext(BreadcrumbContext);
  const label = entity ? entity.label : null;
  const href = entity ? entity.href : undefined;
  React.useEffect(() => {
    setEntity(label ? { label, href } : null);
  }, [label, href, setEntity]);
}
