import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import EventRetentionActions from "@/components/events/EventRetentionActions";
import type { SavedEvent } from "@/lib/saved-events";
import { previewEventSavedSnapshot, type PreviewEvent } from "./redesign-v2-model";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const eventCard = source("components/redesign-v2/EventCard.tsx");
const retentionActions = source("components/events/EventRetentionActions.tsx");
const home = source("components/redesign-v2/RedesignV2Home.tsx");
const search = source("components/redesign-v2/SearchExperience.client.tsx");
const styles = source("components/redesign-v2/RedesignV2.module.css");
const discipline = source("components/redesign-v2/discipline-detail/DisciplineDetailPage.tsx");
const territory = source("components/redesign-v2/zones/TerritoryDetailPage.tsx");
const publicTerritory = source("components/regions/PublicRegionalLanding.tsx");
const previewTerritoryRoute = source("app/preview/redesign-v2/zonas/[territory]/page.tsx");
const calendar = source("components/redesign-v2/calendar/CalendarEventRow.tsx");
const weekend = source("components/redesign-v2/weekend/WeekendEventCard.tsx");
const eventDetail = source("components/redesign-v2/event-detail/EventDetailV2.tsx");

const savedEvent: SavedEvent = {
  slug: "rally-de-prueba",
  title: "Rally de prueba",
  start: "2026-09-19",
  end: "2026-09-20",
  city: "Madrid",
  province: "Madrid",
  venue: "Circuito de prueba",
  discipline: "Rallyes",
  vehicle_type: "coche",
};

test("A9C-B renderiza un único corazón compacto accesible en modo saveOnly", () => {
  const markup = renderToStaticMarkup(createElement(EventRetentionActions, {
    compactIcons: true,
    directChildren: true,
    event: savedEvent,
    saveOnly: true,
    source: "a9cb_test",
  }));

  assert.equal((markup.match(/<button/g) || []).length, 1);
  assert.match(markup, /aria-label="Guardar evento"/);
  assert.match(markup, /aria-pressed="false"/);
  assert.match(markup, /<svg aria-hidden="true"/);
  assert.doesNotMatch(markup, /Añadir al calendario/);
});

test("A9C-B conserva exactamente el payload SavedEvent disponible en PreviewEvent", () => {
  const event = {
    id: "event-id",
    slug: "rally-de-prueba",
    title: "Rally de prueba",
    championship: "Campeonato",
    discipline: "Rallyes",
    start: "2026-09-19",
    end: "",
    venue: "Circuito de prueba",
    city: "Madrid",
    province: "Madrid",
    region: "Comunidad de Madrid",
    tags: [],
    vehicleType: "coche",
    featured: false,
    imageUrl: "",
  } satisfies PreviewEvent;

  assert.deepEqual(previewEventSavedSnapshot(event), {
    slug: "rally-de-prueba",
    title: "Rally de prueba",
    start: "2026-09-19",
    end: "2026-09-19",
    city: "Madrid",
    province: "Madrid",
    venue: "Circuito de prueba",
    discipline: "Rallyes",
    vehicle_type: "coche",
  });
});

test("A9C-B integra save en EventCard fuera del enlace primario sin cambiar su href", () => {
  const linkStart = eventCard.indexOf("<Link className={styles.eventCardHitArea}");
  const linkEnd = eventCard.indexOf("/>", linkStart);
  const mediaStart = eventCard.indexOf("<div className={styles.eventImageLink}>");
  const bodyStart = eventCard.indexOf("<div className={styles.eventCardBody}>");
  const saveStart = eventCard.indexOf("<div className={styles.eventSaveAction}>");

  assert.notEqual(linkStart, -1);
  assert.ok(linkEnd > linkStart);
  assert.ok(mediaStart > linkEnd);
  assert.ok(saveStart > mediaStart);
  assert.ok(saveStart < bodyStart);
  assert.equal((eventCard.match(/<EventRetentionActions/g) || []).length, 1);
  assert.match(eventCard, /compactIcons[\s\S]*?directChildren[\s\S]*?saveOnly/);
  assert.match(eventCard, /const href = previewEventHref\(event\)/);
  assert.match(eventCard, /styles\.dateBlock/);
  assert.match(eventCard, /className=\{styles\.imageLabel\}/);
});

test("A9C-B hace que Home y territorio hereden un único save desde EventCard", () => {
  assert.match(home, /import EventCard from "\.\/EventCard"/);
  assert.match(search, /import EventCard from "\.\/EventCard"/);
  assert.doesNotMatch(home, /EventRetentionActions|SaveButton/);
  assert.doesNotMatch(search, /EventRetentionActions|SaveButton/);

  assert.equal((territory.match(/<EventCard/g) || []).length, 1);
  assert.match(publicTerritory, /<TerritoryDetailPage/);
  assert.match(previewTerritoryRoute, /<TerritoryDetailPage/);
  assert.doesNotMatch(territory, /EventRetentionActions|SaveButton/);
  assert.doesNotMatch(territory, /\/preview\/redesign-v2\/evento/);
});

test("A9C-B añade el mismo saveOnly a la tarjeta local de Disciplina", () => {
  const linkStart = discipline.indexOf("<Link aria-label={`Ver ${event.title}`}");
  const linkEnd = discipline.indexOf("/>", linkStart);
  const mediaStart = discipline.indexOf("<div className={cardStyles.eventImageLink}>");
  const bodyStart = discipline.indexOf("<div className={cardStyles.eventCardBody}>");
  const saveStart = discipline.indexOf("<div className={cardStyles.eventSaveAction}>");

  assert.notEqual(linkStart, -1);
  assert.ok(linkEnd > linkStart);
  assert.ok(mediaStart > linkEnd);
  assert.ok(saveStart > mediaStart);
  assert.ok(saveStart < bodyStart);
  assert.equal((discipline.match(/<EventRetentionActions/g) || []).length, 1);
  assert.match(discipline, /compactIcons[\s\S]*?directChildren[\s\S]*?saveOnly/);
  assert.match(discipline, /source="redesign_v2_discipline_detail"/);
});

test("A9C-B protege Calendar, Weekend y Event Detail con un solo control existente", () => {
  for (const protectedSource of [calendar, weekend, eventDetail]) {
    assert.equal((protectedSource.match(/<EventRetentionActions/g) || []).length, 1);
    assert.doesNotMatch(protectedSource, /saveOnly/);
  }
});

test("A9C-B mantiene el corazón dentro de media, separado de fecha y etiqueta", () => {
  assert.match(styles, /\.eventImageLink\s*\{[\s\S]*?position:\s*relative/);
  assert.match(styles, /\.eventCardHitArea\s*\{[\s\S]*?position:\s*absolute[\s\S]*?z-index:\s*3[\s\S]*?inset:\s*0/);
  assert.match(styles, /\.eventSaveAction\s*\{[\s\S]*?position:\s*absolute[\s\S]*?z-index:\s*5/);
  assert.match(styles, /\.eventSaveAction\s*\{[\s\S]*?top:\s*12px[\s\S]*?right:\s*12px/);
  assert.match(styles, /\.eventSaveAction :global\(\.emc-icon-action\)\s*\{[\s\S]*?width:\s*44px[\s\S]*?height:\s*44px/);
  assert.match(retentionActions, /<span aria-hidden="true" className="emc-save-action-visual">[\s\S]*?<HeartIcon filled=\{saved\} \/>[\s\S]*?<\/span>/);
  assert.match(styles, /\.eventSaveAction :global\(\.emc-icon-action\)\s*\{[\s\S]*?display:\s*flex[\s\S]*?align-items:\s*flex-start[\s\S]*?justify-content:\s*flex-end[\s\S]*?background:\s*transparent/);
  assert.match(styles, /\.eventSaveAction :global\(\.emc-save-action-visual\)\s*\{[\s\S]*?width:\s*32px[\s\S]*?height:\s*32px[\s\S]*?border-radius:\s*999px[\s\S]*?background:\s*rgba\(5, 8, 12, 0\.9\)/);
  assert.match(styles, /\.eventSaveAction :global\(\.emc-icon-action svg\)\s*\{[\s\S]*?width:\s*18px[\s\S]*?height:\s*18px/);
  assert.match(styles, /\.eventSaveAction :global\(\.emc-icon-action-saved\)\s*\{[\s\S]*?color:\s*#ff6200 !important/);
  assert.match(styles, /\.eventSaveAction :global\(\.emc-icon-action:focus-visible\)/);
  assert.doesNotMatch(styles, /\.eventCardFeatured \.eventSaveAction/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.eventSaveAction\s*\{[\s\S]*?top:\s*10px[\s\S]*?right:\s*10px/);
});
