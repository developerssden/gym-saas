"use client";

import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

import { routeItems } from "@/contants/data";

const formatSegment = (segment: string) =>
  segment
    .replace(/[?].*$/, "")
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");

export default function BreadCrumbs() {
  const pathname = usePathname() || "/";

  const title =
    routeItems.find((route) => route.href === pathname)?.title ||
    (pathname === "/" ? "Home" : formatSegment(pathname.split("/").filter(Boolean).pop() ?? ""));

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage className="text-base font-medium">{title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
