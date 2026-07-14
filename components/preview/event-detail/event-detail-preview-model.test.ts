import assert from "node:assert/strict";
import test from "node:test";
import type { EventItem } from "@/types/event";
import {
  buildRelatedPreviewEvents,
  classifyEventTitleLength,
  getAboutText,
  getEventPrimaryAction,
  getPracticalItems,
  getUsefulTags,
  isEventDetailPreviewAvailable,
} from "./event-detail-preview-model";

test("clasifica los títulos sin depender de eventos o viewports concretos", () => {
  assert.equal(classifyEventTitleLength("Motorbeach Festival 2026"), "short");
  assert.equal(classifyEventTitleLength("A".repeat(29)), "medium");
  assert.equal(classifyEventTitleLength("A".repeat(45)), "long");
  assert.equal(
    classifyEventTitleLength("Campeonato de España de Freestyle - Puerto de Santa María"),
    "extraLong",
  );
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

test("la preview solo se bloquea en el deployment de producción de Vercel", () => {
  assert.equal(isEventDetailPreviewAvailable("production"), false);
  assert.equal(isEventDetailPreviewAvailable("preview"), true);
  assert.equal(isEventDetailPreviewAvailable("development"), true);
  assert.equal(isEventDetailPreviewAvailable(undefined), true);
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
  const related = buildRelatedPreviewEvents(current, events, "2026-07-14");
  const slugs = related.map((item) => item.event.slug);

  assert.ok(related.length <= 6);
  assert.equal(slugs.includes(current.slug), false);
  assert.equal(slugs.includes("past"), false);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.equal(related.find((item) => item.event.slug === "near-weekend")?.context, "Cerca");
});
