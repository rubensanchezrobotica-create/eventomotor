import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import EventRetentionActions from "@/components/events/EventRetentionActions";
import ShareEventButton from "@/components/ShareEventButton";
import type { EventItem } from "@/types/event";
import {
  buildRelatedEventDetails,
  classifyEventTitleLength,
  getAboutText,
  getEventPrimaryAction,
  getEventStatusStyle,
  getPracticalGridVariant,
  getPracticalItems,
  getUsefulTags,
  isFallbackEventImage,
  parseStructuredDescription,
} from "./event-detail-model";

test("clasifica los títulos sin depender de eventos o viewports concretos", () => {
  assert.equal(classifyEventTitleLength("Motorbeach Festival 2026"), "short");
  assert.equal(classifyEventTitleLength("A".repeat(29)), "medium");
  assert.equal(classifyEventTitleLength("A".repeat(45)), "long");
  assert.equal(
    classifyEventTitleLength("Campeonato de España de Freestyle - Puerto de Santa María"),
    "extraLong",
  );
});

test("asigna un tono semántico al valor real del estado del evento", () => {
  assert.equal(getEventStatusStyle("confirmed"), "confirmed");
  assert.equal(getEventStatusStyle("cancelled"), "cancelled");
  assert.equal(getEventStatusStyle("postponed"), "postponed");
  assert.equal(getEventStatusStyle("tentative"), "default");
  assert.equal(getEventStatusStyle("Cancelado"), "default");
  assert.equal(getEventStatusStyle(undefined), "default");
});

function eventFixture(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "current",
    slug: "current-event-2026-07-18",
    title: "Current event",
    championship: "Campeonato nacional",
    discipline: "Rally",
    start: "2026-07-18",
    end: "2026-07-19",
    venue: "Recinto principal",
    city: "Madrid",
    province: "Madrid",
    region: "Comunidad de Madrid",
    country: "ES",
    level: "Publicado",
    source: "Federación",
    sourceUrl: "https://example.com/oficial",
    officialUrl: "https://example.com/oficial",
    ticketUrl: "",
    registrationUrl: "",
    tags: ["Rally", "coche", "Madrid", "asfalto"],
    vehicleType: "coche",
    vehicle_type: "coche",
    featured: false,
    ...overrides,
  };
}

test("la variante directa entrega los tres botones como hijos de una sola cuadrícula", () => {
  const event = {
    slug: "evento-directo",
    title: "Evento directo",
    start: "2026-07-18",
    end: "2026-07-18",
    city: "Madrid",
    province: "Madrid",
    venue: "Recinto principal",
    discipline: "Rally",
  };
  const directMarkup = renderToStaticMarkup(createElement(
    "div",
    { className: "utility-grid" },
    createElement(EventRetentionActions, { calendarLabel: "Añadir al calendario", directChildren: true, event }),
    createElement(ShareEventButton, { directChildren: true, title: event.title, url: "https://example.com/evento" }),
  ));
  const defaultMarkup = renderToStaticMarkup(createElement(
    "div",
    null,
    createElement(EventRetentionActions, { event }),
    createElement(ShareEventButton, { title: event.title, url: "https://example.com/evento" }),
  ));

  assert.match(
    directMarkup,
    /^<div class="utility-grid"><button[^>]*>Guardar<\/button><button[^>]*>Añadir al calendario<\/button><button[^>]*>Compartir<\/button><\/div>$/,
  );
  assert.doesNotMatch(directMarkup, /emc-retention-actions|emc-share-action/);
  assert.match(defaultMarkup, /emc-retention-actions/);
  assert.match(defaultMarkup, /emc-share-action/);
});

test("la acción principal respeta registro, entradas y fuente oficial", () => {
  assert.deepEqual(
    getEventPrimaryAction(eventFixture({ registrationUrl: "https://example.com/registro" })),
    { href: "https://example.com/registro", label: "Inscribirse", type: "registration" },
  );
  assert.deepEqual(
    getEventPrimaryAction(eventFixture({
      registrationUrl: "https://example.com/entrada",
      ticketUrl: "https://example.com/entrada",
    })),
    { href: "https://example.com/entrada", label: "Comprar entradas", type: "ticket" },
  );
  assert.deepEqual(
    getEventPrimaryAction(eventFixture()),
    { href: "https://example.com/oficial", label: "Fuente oficial", type: "official" },
  );
});

test("los datos prácticos y las etiquetas eliminan repeticiones evidentes", () => {
  const event = eventFixture();
  const practical = getPracticalItems(event);
  const tags = getUsefulTags(event);

  assert.ok(practical.length >= 4);
  assert.equal(practical.some((item) => item.label === "País"), false);
  assert.deepEqual(tags, ["Madrid", "asfalto"]);
});

test("el grid práctico deriva una variante estable de uno a seis elementos", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7].map(getPracticalGridVariant),
    ["one", "two", "three", "four", "five", "six", "six"],
  );
});

test("distingue los fallbacks del espacio de imágenes reales resuelto por la preview", () => {
  assert.equal(isFallbackEventImage("/images/disciplines/eventomotor-fallback-feria.webp"), true);
  assert.equal(isFallbackEventImage("/event-images/xiv-concentracion-classic-alcoy-2026.png"), false);
  assert.equal(isFallbackEventImage("https://example.com/cartel.webp"), false);
});

test("estructura solo prefijos permitidos al inicio y conserva todas las líneas", () => {
  const source = [
    "Descripción: Una jornada para vehículos clásicos.",
    "Programa: 09:00 h - Recepción;",
    "10:00 h - Almuerzo.",
    "Precio: 10 € por persona.",
    "Fecha límite de inscripción: 19 de junio de 2026.",
    "Contacto: club@example.com.",
    "Redes: Instagram: club; Facebook: club.",
  ].join("\n");
  const parsed = parseStructuredDescription(source);

  assert.ok(parsed);
  assert.deepEqual(
    parsed.blocks.map(({ kind, label }) => ({ kind, label })),
    [
      { kind: "description", label: "Descripción" },
      { kind: "field", label: "Programa" },
      { kind: "field", label: "Precio" },
      { kind: "field", label: "Fecha límite de inscripción" },
      { kind: "field", label: "Contacto" },
      { kind: "field", label: "Redes" },
    ],
  );
  assert.equal(parsed.blocks[1]?.value, "09:00 h - Recepción;\n10:00 h - Almuerzo.");
  assert.equal(parsed.blocks.flatMap((block) => block.sourceLines).join("\n"), source);
  assert.equal(parsed.sourceText, source);
});

test("mantiene el texto normal y no reconoce prefijos en mitad de una frase", () => {
  assert.equal(parseStructuredDescription("Texto editorial normal sin campos."), null);
  assert.equal(parseStructuredDescription("La entrada incluye Precio: 10 € por persona."), null);
  assert.equal(parseStructuredDescription(" Descripción: no comienza al inicio exacto de la línea."), null);
});

test("las notas administrativas no sustituyen contenido editorial ausente", () => {
  const event = eventFixture({
    notes: "Evento de automovilismo importado para revisión editorial. Verificar ubicación exacta antes de publicar.",
  });

  assert.equal(getAboutText(event), "");
});

test("los relacionados se unifican, excluyen el actual y no contienen duplicados", () => {
  const current = eventFixture();
  const events = [
    current,
    eventFixture({ id: "near-weekend", slug: "near-weekend", title: "Near weekend", start: "2026-07-18" }),
    eventFixture({ id: "near", slug: "near", title: "Near", start: "2026-07-25", discipline: "Karting" }),
    eventFixture({ id: "weekend", slug: "weekend", title: "Weekend", start: "2026-07-19", province: "Toledo" }),
    eventFixture({ id: "rally-one", slug: "rally-one", title: "Rally one", start: "2026-08-01", province: "Asturias" }),
    eventFixture({ id: "rally-two", slug: "rally-two", title: "Rally two", start: "2026-08-08", province: "León" }),
    eventFixture({ id: "rally-three", slug: "rally-three", title: "Rally three", start: "2026-08-15", province: "Lugo" }),
    eventFixture({ id: "past", slug: "past", title: "Past", start: "2026-07-01" }),
  ];
  const related = buildRelatedEventDetails(current, events, "2026-07-14");
  const slugs = related.map((item) => item.event.slug);

  assert.ok(related.length <= 6);
  assert.equal(slugs.includes(current.slug), false);
  assert.equal(slugs.includes("past"), false);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.equal(related.find((item) => item.event.slug === "near-weekend")?.context, "Cerca");
});
