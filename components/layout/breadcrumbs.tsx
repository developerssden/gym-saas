"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { breadcrumbsFor } from "@/lib/navigation";
import { useBreadcrumbEntity } from "./breadcrumb-context";

/**
 * "Members › Add" on pages below a menu page. Nothing on menu pages (the page
 * heading already says where you are). Desktop only: phones show the branch.
 */
export default function BreadCrumbs() {
  const pathname = usePathname() || "/";
  const action = useSearchParams()?.get("action");
  const entity = useBreadcrumbEntity();
  const crumbs = breadcrumbsFor(pathname, action, entity);
  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb className="hidden min-w-0 md:block">
      <BreadcrumbList>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${i}`}>
              <BreadcrumbItem className="min-w-0">
                {isLast || !crumb.href ? (
                  <BreadcrumbPage className="truncate font-medium">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
