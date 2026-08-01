import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gym SaaS",
    short_name: "Gym SaaS",
    description: "The all-in-one platform for modern gym management.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FBFBF9",
    theme_color: "#BDDE63",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
