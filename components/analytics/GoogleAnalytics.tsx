"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  COOKIE_CONSENT_EVENT,
  applyAnalyticsConsent,
  hasAnalyticsConsent,
} from "@/lib/cookie-consent";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const NEWSLETTER_ANALYTICS_EXCLUDED_ROUTES = new Set([
  "/preview/newsletter/confirm",
  "/preview/newsletter/unsubscribe",
  "/newsletter",
  "/newsletter/confirm",
  "/newsletter/unsubscribe",
]);

export function isAnalyticsExcludedPath(pathname: string): boolean {
  return (
    NEWSLETTER_ANALYTICS_EXCLUDED_ROUTES.has(pathname) ||
    pathname === "/preview/newsletter/mailbox" ||
    pathname.startsWith("/preview/newsletter/mailbox/")
  );
}

function GoogleAnalyticsPageViews({ ready }: { ready: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (
      isAnalyticsExcludedPath(pathname) ||
      !ready ||
      !GA_ID ||
      !hasAnalyticsConsent() ||
      typeof window === "undefined" ||
      typeof window.gtag !== "function"
    ) return;

    const query = searchParams.toString();
    window.gtag("config", GA_ID, {
      page_path: query ? `${pathname}?${query}` : pathname,
    });
  }, [pathname, ready, searchParams]);

  return null;
}

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handleConsentChange = () => {
      const allowed = hasAnalyticsConsent();
      applyAnalyticsConsent(GA_ID, allowed);
      setAnalyticsAllowed(allowed);
    };

    queueMicrotask(handleConsentChange);
    window.addEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);
  }, []);

  if (!GA_ID) return null;
  if (!analyticsAllowed) return null;
  if (isAnalyticsExcludedPath(pathname)) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="eventomotor-ga4" strategy="afterInteractive" onReady={() => setReady(true)}>
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { send_page_view: false });
        `}
      </Script>
      <Suspense fallback={null}>
        <GoogleAnalyticsPageViews ready={ready} />
      </Suspense>
    </>
  );
}
