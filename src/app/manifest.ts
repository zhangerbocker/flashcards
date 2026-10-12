import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HSK Study",
    short_name: "学中文",
    description: "Flashcards, reading and chat for HSK 1–3",
    start_url: "/cards",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#b91c1c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
