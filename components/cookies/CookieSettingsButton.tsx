"use client";

import { openCookieSettings } from "@/lib/cookie-consent";

export default function CookieSettingsButton() {
  return (
    <button className="em-cookie-footer-button" type="button" onClick={openCookieSettings}>
      Configurar cookies
    </button>
  );
}
