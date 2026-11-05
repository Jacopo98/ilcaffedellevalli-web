import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Il Caffè delle Valli · Area gestionale",
    short_name: "Il Caffè delle Valli",
    description: "Area riservata per la gestione de Il Caffè delle Valli.",
    start_url: "/area-riservata",
    scope: "/",
    display: "standalone",
    background_color: "#1c1c1a",
    theme_color: "#1c1c1a",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/app-icon-dark.png",
        sizes: "1254x1254",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app-icon-dark.png",
        sizes: "1254x1254",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
