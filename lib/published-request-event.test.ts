import assert from "node:assert/strict";
import test from "node:test";
import {
  isDirectImageUrl,
  normalizeRegistrationUrl,
  normalizeSubmissionTicketInput,
  normalizeTicketUrl,
  normalizeWhatsAppRegistrationUrl,
  publicationDraftToEvent,
  publicationImageFields,
  sanitizePublicEditorialText,
} from "./published-request-event";

test("normaliza teléfonos españoles solo como inscripción por WhatsApp", () => {
  assert.equal(normalizeWhatsAppRegistrationUrl("611 636 103"), "https://wa.me/34611636103");
  assert.equal(normalizeWhatsAppRegistrationUrl("+34 611 636 103"), "https://wa.me/34611636103");
  assert.equal(normalizeWhatsAppRegistrationUrl("https://611636103"), "https://wa.me/34611636103");
  assert.equal(normalizeWhatsAppRegistrationUrl("https://wa.me/34611636103"), "https://wa.me/34611636103");
  assert.equal(normalizeWhatsAppRegistrationUrl("123"), null);
});

test("distingue entradas, inscripción y URLs inválidas", () => {
  assert.equal(normalizeTicketUrl("https://tickets.example.com/venta"), "https://tickets.example.com/venta");
  assert.equal(normalizeTicketUrl("https://611636103"), null);
  assert.equal(normalizeTicketUrl(""), null);
  assert.equal(normalizeTicketUrl("javascript:alert(1)"), null);
  assert.equal(normalizeRegistrationUrl("https://example.com/registro"), "https://example.com/registro");
  assert.equal(normalizeRegistrationUrl("", "+34 611 636 103"), "https://wa.me/34611636103");
  assert.equal(normalizeSubmissionTicketInput("611 636 103"), "https://wa.me/34611636103");
  assert.equal(normalizeSubmissionTicketInput("tickets.example.com/venta"), "https://tickets.example.com/venta");
  assert.equal(normalizeSubmissionTicketInput("no es una url"), null);
});

test("Instagram puede ser fuente de imagen pero nunca imagen directa", () => {
  const instagram = "https://www.instagram.com/clasicosbara/";
  assert.equal(isDirectImageUrl(instagram), false);
  assert.deepEqual(publicationImageFields(instagram), {
    image_url: null,
    image_source_url: instagram,
  });
  assert.equal(isDirectImageUrl("https://cdn.example.com/cartel.webp"), true);
});

test("el mapeo no mezcla organizador, contacto ni metadatos internos con campos públicos", () => {
  const event = publicationDraftToEvent({
    title: "Concentración de Coches",
    slug: "concentracion-de-coches-baranain-2026-09-12",
    description: "Texto editorial",
    startDate: "2026-09-12",
    city: "Barañáin",
    province: "Navarra",
    discipline: "Clásicos",
    organizer: "Naiara",
    sourceUrl: "https://www.instagram.com/clasicosbara/",
    ticketUrl: "https://611636103",
    registrationUrl: "611 636 103",
    posterUrl: "https://www.instagram.com/clasicosbara/",
    sourceSubmissionId: "b008383e-d4d0-4bfe-a613-894057664286",
    contactName: "Naiara",
    contactEmail: "privado@example.com",
  } as Record<string, unknown>);

  assert.equal(event.slug, "concentracion-de-coches-baranain-2026-09-12");
  assert.equal(event.championship, null);
  assert.equal(event.organizer_name, "Naiara");
  assert.equal(event.ticket_url, null);
  assert.equal(event.registration_url, "https://wa.me/34611636103");
  assert.equal(event.image_url, null);
  assert.equal(event.image_source_url, "https://www.instagram.com/clasicosbara/");
  assert.equal(event.notes, null);
  assert.doesNotMatch(JSON.stringify(event), /privado@example\.com|b008383e-d4d0-4bfe-a613-894057664286/);
});

test("la defensa pública elimina solo líneas internas y UUID, conservando texto editorial", () => {
  const sanitized = sanitizePublicEditorialText([
    "Texto editorial legítimo.",
    "Precio: Entrada gratuita.",
    "Cartel/imagen: https://www.instagram.com/perfil/",
    "Email contacto: privado@example.com",
    "Teléfono contacto: +34611636103",
    "Solicitud origen: b008383e-d4d0-4bfe-a613-894057664286",
    "Cierre editorial.",
  ].join("\n"));

  assert.equal(sanitized, "Texto editorial legítimo.\nPrecio: Entrada gratuita.\nCierre editorial.");
});
