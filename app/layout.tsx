import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EventoMotor | Calendario de eventos de motor en España",
  description:
    "Encuentra eventos de motor en España: motos, coches, rallyes, concentraciones, motocross, trackdays, ferias y competiciones en un calendario visual actualizado.",
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
