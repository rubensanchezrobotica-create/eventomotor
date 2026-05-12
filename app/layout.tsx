import type { Metadata } from "next";
import CookieConsent from "@/components/cookies/CookieConsent";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import { absoluteUrl, CONTACT_EMAIL, DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, LOGO_URL, SITE_NAME, SITE_URL } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    locale: "es_ES",
    images: [
      {
        url: absoluteUrl(DEFAULT_OG_IMAGE),
        width: 1024,
        height: 1024,
        alt: "EventoMotor",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
  },
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

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: absoluteUrl(LOGO_URL),
  contactPoint: {
    "@type": "ContactPoint",
    email: CONTACT_EMAIL,
    contactType: "customer support",
    areaServed: "ES",
    availableLanguage: ["es"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {children}
        <CookieConsent />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
