import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EventoMotor",
    short_name: "EventoMotor",
    description: "Calendario nacional de eventos de motor en España.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#050505",
    theme_color: "#ff3b00",
    lang: "es",
    orientation: "portrait",
    categories: ["sports", "entertainment", "travel"],
    icons: [
      {
        src: "/brand/eventomotor-app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/eventomotor-app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/eventomotor-app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
