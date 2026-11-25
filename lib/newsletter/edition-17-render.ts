import {
  NEWSLETTER_EDITION_17_CAMPAIGN_KEY,
  NEWSLETTER_EDITION_17_EVENTS,
  NEWSLETTER_EDITION_17_INTRO,
  NEWSLETTER_EDITION_17_PREHEADER,
  NEWSLETTER_EDITION_17_SUBJECT,
  edition17TrackedUrl,
  type NewsletterEdition17Event,
} from "./edition-17-editorial";
import {
  NEWSLETTER_EDITION_17_TERRITORIAL_MODULES,
  type NewsletterEdition17ContentVariant,
} from "./edition-17-territorial";

export const NEWSLETTER_EDITION_17_CANONICAL_UNSUBSCRIBE_URL =
  "https://www.eventomotor.com/newsletter/unsubscribe?token=edition17-preview-token-fixture-000000000000";
const REVIEW_WARNING = '<div style="padding:12px;background-color:#ffe7d7;color:#7c2d12;font-family:Arial,Helvetica,sans-serif;font-size:13px;text-align:center;">PREVIEW LOCAL · SELLO PENDIENTE · NO ENVIAR</div>';

type Edition17DraftAssetMode = "review-local";

function html(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function imageBlock(file: string, alt: string, width: number, mode: Edition17DraftAssetMode): string {
  if (mode !== "review-local") throw new Error("Edition 17 production asset mode unavailable");
  return `<img src="assets/${html(file)}" width="${width}" alt="${html(alt)}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;">`;
}

function paragraph(value: string, compact: boolean): string {
  return `<p style="margin:0 0 ${compact ? 8 : 9}px;font-family:Arial,Helvetica,sans-serif;font-size:${compact ? 14 : 15}px;line-height:${compact ? 21 : 23}px;color:#4b5563;">${html(value)}</p>`;
}

function card(event: NewsletterEdition17Event, mode: Edition17DraftAssetMode): string {
  const url = html(edition17TrackedUrl(event.url, event.utmContent));
  const [dates, ...location] = event.meta.split(" · ");
  const categoryColor = event.category.startsWith("Reserva fecha") ? "#ff5a0a" : "#111827";
  return `<tr><td style="padding:0 0 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f1f3f5" style="border:1px solid #c4ccd5;border-radius:14px;background-color:#f1f3f5;overflow:hidden;"><tr>
    <td class="stack-column" width="42%" valign="top" style="padding:0;"><a href="${url}" style="text-decoration:none;">${imageBlock(event.image, event.imageAlt, 236, mode)}</a></td>
    <td class="stack-column" width="58%" valign="middle" style="padding:18px;box-sizing:border-box;overflow-wrap:break-word;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;letter-spacing:1.1px;font-weight:700;color:${categoryColor};text-transform:uppercase;">${html(event.category)}</div>
      <h3 style="margin:5px 0 7px;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:25px;color:#111827;font-weight:800;">${html(event.title)}</h3>
      <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#4b5563;"><strong style="color:#111827;">${html(dates ?? "")}</strong>${location.length ? ` · ${html(location.join(" · "))}` : ""}</p>
      ${event.paragraphs.map((value) => paragraph(value, true)).join("\n")}
      <a href="${url}" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;font-weight:700;color:#111827;text-decoration:none;">${html(event.cta)} <span style="color:#ff5a0a;">→</span></a>
    </td></tr></table></td></tr>`;
}

function territorialEvent(variant: NewsletterEdition17ContentVariant): NewsletterEdition17Event | null {
  if (variant !== "madrid") return null;
  return {
    ...NEWSLETTER_EDITION_17_TERRITORIAL_MODULES["comunidad-de-madrid"],
    category: "Trial indoor · Madrid",
  };
}

export function renderEdition17Draft(
  variant: NewsletterEdition17ContentVariant,
  mode: Edition17DraftAssetMode = "review-local",
): { html: string; text: string } {
  if (variant !== "national" && variant !== "madrid") {
    throw new Error("Edition 17 draft: inactive content variant");
  }
  const [hero, ...cards] = NEWSLETTER_EDITION_17_EVENTS;
  if (!hero) throw new Error("Edition 17 draft: hero missing");
  const regional = territorialEvent(variant);
  const heroUrl = html(edition17TrackedUrl(hero.url, hero.utmContent));
  const closingUrl = html(edition17TrackedUrl("https://www.eventomotor.com/", "agenda_completa"));
  const heroParagraphs = hero.paragraphs.map((value) => paragraph(value, false)).join("\n");
  const regionalHtml = regional
    ? `<tr><td class="mobile-pad" style="padding:4px 28px 8px;"><div style="margin:0 0 11px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;font-weight:800;letter-spacing:1.2px;color:#ff5a0a;text-transform:uppercase;">Lo próximo cerca de ti</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${card(regional, mode)}</table></td></tr>`
    : "";
  const emailHtml = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(NEWSLETTER_EDITION_17_SUBJECT)}</title>
<style>body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-collapse:collapse;border-spacing:0}img{border:0;line-height:100%;outline:none;text-decoration:none}a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}@media only screen and (max-width:700px){.email-shell{width:100%!important;max-width:620px!important;border-radius:0!important}.mobile-pad{padding-left:20px!important;padding-right:20px!important}.stack-column{display:block!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important}.stack-column img{max-width:100%!important;width:100%!important;height:auto!important}.hero-title{font-size:29px!important;line-height:34px!important}}</style></head>
<body bgcolor="#cfd6de" style="margin:0;padding:0;background-color:#cfd6de;">${REVIEW_WARNING}<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${html(NEWSLETTER_EDITION_17_PREHEADER)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#cfd6de"><tr><td align="center" style="padding:22px 0;"><table class="email-shell" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#dde3e9" style="width:100%;max-width:620px;background-color:#dde3e9;border-radius:18px;overflow:hidden;">
<tr bgcolor="#050608"><td align="center" bgcolor="#050608" style="padding:0;background-color:#050608;border-bottom:1px solid #23262d;">${imageBlock("eventomotor-header.png", "EventoMotor · La Agenda Motor · Edición 17", 620, mode)}</td></tr>
<tr><td class="mobile-pad" bgcolor="#e6ebf0" style="padding:27px 28px 20px;background-color:#e6ebf0;"><div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.4px;color:#111827;text-transform:uppercase;">La selección de esta semana</div><h1 class="hero-title" style="margin:7px 0 11px;font-family:Arial,Helvetica,sans-serif;font-size:35px;line-height:40px;letter-spacing:-0.8px;color:#111827;font-weight:900;">${html(NEWSLETTER_EDITION_17_SUBJECT)}</h1><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px;color:#4b5563;">${html(NEWSLETTER_EDITION_17_INTRO)}</p></td></tr>
<tr><td class="mobile-pad" bgcolor="#e6ebf0" style="padding:0 28px 23px;background-color:#e6ebf0;"><a href="${heroUrl}" style="text-decoration:none;">${imageBlock(hero.image, hero.imageAlt, 564, mode)}</a><div style="padding:18px 2px 0;"><div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.2px;color:#111827;text-transform:uppercase;">${html(hero.category)}</div><h2 style="margin:5px 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:32px;color:#111827;font-weight:900;">${html(hero.title)}</h2><p style="margin:0 0 9px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#4b5563;">${html(hero.meta)}</p>${heroParagraphs}<a href="${heroUrl}" style="display:inline-block;background-color:#ff5a0a;color:#111827;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;font-weight:800;padding:12px 17px;border-radius:9px;">${html(hero.cta)}</a></div></td></tr>
<tr><td class="mobile-pad" style="padding:1px 28px 10px;"><h2 style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:30px;color:#111827;font-weight:900;">Más planes y próximas citas</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${cards.map((event) => card(event, mode)).join("\n")}</table></td></tr>
${regionalHtml}
<tr><td class="mobile-pad" style="padding:5px 28px 30px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#d6dde4" style="background-color:#d6dde4;border:1px solid #c4ccd5;border-radius:14px;"><tr><td align="center" style="padding:23px 20px;"><h2 style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:28px;color:#111827;font-weight:900;">¿Todavía no tienes plan?</h2><p style="margin:0 0 15px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#4b5563;">Consulta la agenda completa y encuentra eventos por fecha, disciplina o zona.</p><a href="${closingUrl}" style="display:inline-block;background-color:#ff5a0a;color:#111827;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;font-weight:800;padding:12px 17px;border-radius:9px;">Ver todos los eventos</a></td></tr></table></td></tr>
<tr bgcolor="#090b0f"><td bgcolor="#090b0f" style="padding:20px 28px 24px;background-color:#090b0f;border-top:1px solid #23262d;"><p style="margin:0 0 11px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#cbd0d8;">La información puede sufrir modificaciones. Antes de desplazarte, revisa la ficha y los canales oficiales del evento para confirmar horarios, ubicación y programa.</p><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;color:#cbd0d8;"><a href="https://www.eventomotor.com/privacidad" style="color:#cbd0d8!important;text-decoration:underline;">Privacidad</a>&nbsp;·&nbsp;<a href="https://www.eventomotor.com/aviso-legal" style="color:#cbd0d8!important;text-decoration:underline;">Aviso legal</a>&nbsp;·&nbsp;<a href="${NEWSLETTER_EDITION_17_CANONICAL_UNSUBSCRIBE_URL}" style="color:#cbd0d8!important;text-decoration:underline;">Darme de baja</a></p><p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:18px;color:#9ca3af;">La Agenda Motor · EventoMotor · info@eventomotor.com</p></td></tr>
</table></td></tr></table></body></html>`;
  const eventText = (event: NewsletterEdition17Event) =>
    `${event.category.toUpperCase()}\n${event.title}\n${event.meta}\n\n${event.paragraphs.join("\n\n")}\n\n${event.cta}:\n${edition17TrackedUrl(event.url, event.utmContent)}`;
  const emailText = `LA AGENDA MOTOR · EDICIÓN 17\n26 NOVIEMBRE 2026\n\n${NEWSLETTER_EDITION_17_SUBJECT}\n\n${NEWSLETTER_EDITION_17_PREHEADER}\n\n${NEWSLETTER_EDITION_17_INTRO}\n\n${NEWSLETTER_EDITION_17_EVENTS.map(eventText).join("\n\n")}\n\n${regional ? `LO PRÓXIMO CERCA DE TI\n${eventText(regional)}\n\n` : ""}¿TODAVÍA NO TIENES PLAN?\n\nConsulta la agenda completa y encuentra eventos por fecha, disciplina o zona.\n\nVer todos los eventos:\n${edition17TrackedUrl("https://www.eventomotor.com/", "agenda_completa")}\n\nPrivacidad: https://www.eventomotor.com/privacidad\nAviso legal: https://www.eventomotor.com/aviso-legal\nDarme de baja: ${NEWSLETTER_EDITION_17_CANONICAL_UNSUBSCRIBE_URL}\n`;
  if (!emailHtml.includes(NEWSLETTER_EDITION_17_CAMPAIGN_KEY)) {
    throw new Error("Edition 17 draft: campaign tracking missing");
  }
  return { html: emailHtml, text: emailText };
}
