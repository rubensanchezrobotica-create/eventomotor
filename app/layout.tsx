import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EventoMotor | Eventos del motor en España",
  description: "Calendario para descubrir eventos del motor en España.",
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
