import { randomUUID } from "node:crypto";
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// Entries without a revision are never revalidated, so tie /offline to this build.
const buildRevision = randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: [{ url: "/offline", revision: buildRevision }],
});

const nextConfig: NextConfig = {};

export default withSerwist(nextConfig);
