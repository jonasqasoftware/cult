import type { MetadataRoute } from "next";

// M8 section 49 — native App Router manifest support, no extra tooling.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CULT",
    short_name: "CULT",
    description: "Descubra o que fazer em Porto Alegre.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f3ec",
    theme_color: "#c4401f",
    lang: "pt-BR",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
