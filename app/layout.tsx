import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EventoMotor | Calendario de eventos de motor en España",
  description:
    "Encuentra eventos de motor en España: motos, coches, rallyes, concentraciones, motocross, trackdays, ferias y competiciones en un calendario visual actualizado.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/eventomotor-app-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/eventomotor-app-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/eventomotor-app-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/brand/eventomotor-app-icon-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
