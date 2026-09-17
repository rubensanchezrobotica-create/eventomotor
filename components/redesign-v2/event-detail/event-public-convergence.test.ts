import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { EventItem } from "@/types/event";
import { eventSlugRedirectHref } from "@/lib/event-slug-redirects";
import { buildEventBreadcrumbJsonLd, buildEventJsonLd, buildEventMetadata } from "@/lib/event-page-seo";
import { buildFaqPageJsonLd, getEventSeoOverride, LA_BANEZA_EVENT_SLUG } from "@/lib/event-seo-overrides";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const route = source("app/evento/[slug]/page.tsx");
const preview = source("app/preview/redesign-v2/evento/[slug]/page.tsx");
const component = source("components/redesign-v2/event-detail/EventDetailV2.tsx");
const model = source("components/redesign-v2/event-detail/event-detail-model.ts");
const styles = source("components/redesign-v2/event-detail/EventDetailV2.module.css");
const shell = source("components/redesign-v2/site/V2InteriorShell.tsx");

function fixture(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "event-1",
    slug: LA_BANEZA_EVENT_SLUG,
    title: "Gran Premio de La Bañeza",
    championship: "Clásicas",
    discipline: "Circuito",
    start: "2026-08-07",
    end: "2026-08-09",
    venue: "La Bañeza",
    city: "La Bañeza",
    province: "León",
    region: "Castilla y León",
    level: "Publicado",
    source: "Organización",
    sourceUrl: "https://example.com/oficial",
    ticketUrl: "",
    tags: ["Circuito"],
    vehicleType: "moto",
    featured: false,
    ...overrides,
  };
}

test("A10G mantiene lookup público visible y fail-closed; Preview no sustituye ese loader", () => {
  assert.match(route, /\.from\("events"\)[\s\S]*?\.eq\("visible", true\)/);
  assert.match(route, /if \(!supabase\) return \[\]/);
  assert.match(route, /if \(error \|\| !data\) return \[\]/);
  assert.match(route, /events\.find\(\(item\) => item\.slug === slug\)/);
  assert.match(route, /if \(!event\) notFound\(\)/);
  assert.match(route, /<EventDetailV2[\s\S]*?routeContext="public"/);
  assert.match(preview, /routeContext="preview"/);
  assert.match(preview, /index: false[\s\S]*?follow: false/);
  assert.doesNotMatch(route, /from "@\/lib\/public-events"/);
});

test("A10G mantiene redirect 308 conocido y query antes del 404, sin enlaces Preview", () => {
  assert.equal(
    eventSlugRedirectHref("rpm-fest-night-demons-2026-2026-08-15", { utm_source: "agenda", tag: ["moto", "rally"] }),
    "/evento/rpm-fest-night-demons-2026?utm_source=agenda&tag=moto&tag=rally",
  );
  assert.equal(eventSlugRedirectHref("slug-invalido"), null);
  assert.match(route, /eventSlugRedirectHref\(slug, await searchParams\)/);
  assert.match(route, /permanentRedirect\(redirectHref\)/);
  assert.ok(route.indexOf("permanentRedirect(redirectHref)") < route.indexOf("if (!event) notFound();"));
});

test("A10G preserva metadatos SEO, override, Event/Breadcrumb/FAQ JSON-LD de la ruta", () => {
  const event = fixture();
  const override = getEventSeoOverride(event.slug);
  assert.ok(override?.faqItems?.length);
  const metadata = buildEventMetadata(event, "https://www.eventomotor.com", event.slug || event.id, {
    title: "Título fallback",
    description: "Descripción fallback",
  });
  assert.equal(metadata.alternates?.canonical, `https://www.eventomotor.com/evento/${event.slug}`);
  assert.equal(metadata.description, override.seoDescription);
  assert.equal(metadata.openGraph?.description, override.seoDescription);
  assert.equal(metadata.twitter?.description, override.seoDescription);
  const url = `https://www.eventomotor.com/evento/${event.slug}`;
  const eventJsonLd = buildEventJsonLd(event, url, "https://www.eventomotor.com/image.jpg", override.seoDescription || "");
  assert.equal(eventJsonLd["@type"], "Event");
  assert.equal(eventJsonLd.url, url);
  assert.equal(eventJsonLd.startDate, event.start);
  assert.equal(eventJsonLd.endDate, event.end);
  const breadcrumb = buildEventBreadcrumbJsonLd(event, url, "https://www.eventomotor.com");
  assert.equal(breadcrumb.itemListElement[2].item, url);
  assert.equal(buildFaqPageJsonLd(override.faqItems)["@type"], "FAQPage");
  assert.equal((route.match(/type="application\/ld\+json"/g) ?? []).length, 3);
  assert.match(route, /faqItems\?\.length \? \(/);
  assert.match(component, /publicContext\?\.faqItems\?\.length \? \(/);
});

test("A10G conserva acciones y nombres de analítica pública sin tocar save, ICS ni share", () => {
  for (const name of ["click_official_source", "click_tickets", "click_event_maps", "click_event_organizer", "click_related_event"]) {
    assert.match(component, new RegExp(name));
  }
  assert.match(component, /eventAnalyticsParams\(publicContext\.event/);
  assert.match(component, /ticket_url_domain: urlDomain\(model\.primaryAction\.href\)/);
  assert.match(component, /source_event_slug: model\.slug/);
  assert.match(component, /source=\{routeContext === "public" \? "event_detail"/);
  assert.equal((component.match(/<EventRetentionActions/g) ?? []).length, 1);
  assert.equal((component.match(/<ShareEventButton/g) ?? []).length, 1);
  assert.match(component, /calendarLabel="Añadir al calendario"/);
  assert.match(component, /<TrackLink[\s\S]*?eventName="click_related_event"/);
  assert.match(component, /trackPublicEventDetailNavigation=\{routeContext === "public"\}/);
  assert.equal((shell.match(/eventName="click_publish_event"/g) ?? []).length, 2);
  assert.match(shell, /source: "static_header_cta"/);
  assert.match(shell, /source: "footer_link"/);
});

test("A10G no filtra la captación pública y no filtra destinos Preview al contexto público", () => {
  assert.match(route, /currentNewsletterPublicLaunchEnvironment\(\)/);
  assert.match(route, /!canaryConfiguration\.enabled/);
  assert.match(route, /isNewsletterPublicLaunchPageRequestAllowed\(/);
  assert.match(component, /routeContext === "preview" \|\| publicContext\?\.newsletterPublicLaunchEnabled/);
  assert.match(component, /navigationMode=\{routeContext\}/);
  assert.match(model, /routeContext === "public" \? `\/evento\/\$\{slug\}` : `\/preview\/redesign-v2\/evento\/\$\{slug\}`/);
});

test("A10G conserva imagen y temporalidad compartidas y diferencia sólo la presentación pública", () => {
  assert.match(model, /assignV2HomeEventImages\(\[event\]\)/);
  assert.match(model, /previewEventStatus\(projectPreviewEvent\(event\)/);
  assert.match(component, /routeContext === "public" \? redesignV2DisplayPilot\.variable/);
  assert.match(styles, /\.shellScope\[data-v2-event-context="public"\]/);
  assert.match(styles, /font-family: var\(--font-v2-display-pilot\)/);
  assert.doesNotMatch(component, /usePathname|\.replace\("\/preview/);
});
