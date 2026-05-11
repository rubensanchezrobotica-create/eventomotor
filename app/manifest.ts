import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EventoMotor",
    short_name: "EventoMotor",
    description: "Calendario de eventos de motor en España.",
    start_url: "/",
    display: "standalone",
    background_color: "#050609",
    theme_color: "#ff3b00",
    icons: [
      {
        src: "/brand/eventomotor-app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/eventomotor-app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
