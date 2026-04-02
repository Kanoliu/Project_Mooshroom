import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Project Mooshroom",
    short_name: "Mooshroom",
    description: "A Progressive Web App starter built with Next.js.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4efe2",
    theme_color: "#f4efe2",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.webp",
        sizes: "512x512",
        type: "image/webp",
        purpose: "maskable",
      },
    ],
  };
}
