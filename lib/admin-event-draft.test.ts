import assert from "node:assert/strict";
import test from "node:test";
import {
  createEditableEventDraft,
  eventDraftFingerprint,
  isCurrentEventDraftValidated,
  resetEditableEventDraft,
  updateEditableEventDraft,
  validateEditableEventDraft,
  type EditableEventDraft,
  type EventDraftSource,
} from "./admin-event-draft";
import { publicationDraftToEvent } from "./published-request-event";

const SUBMISSION_ID = "35fcf8a6-1918-429c-aa07-5a4ff99cc6ca";
const TICKET_URL = "https://www.fourvenues.com/diamond-squad-events/M028";
const SOURCE_URL = "https://www.instagram.com/rpmfest.official/";

function rpmSubmission(overrides: Partial<EventDraftSource> = {}): EventDraftSource {
  return {
    id: SUBMISSION_ID,
    event_name: "RPM FEST – Night Demons 2026",
    start_date: "2026-08-15",
    end_date: "2026-08-15",
    venue: "Circuito Internacional FK1",
    city: null,
    province: null,
    discipline: "Otros",
    vehicle_type: "mixto",
    source_url: SOURCE_URL,
    ticket_url: TICKET_URL,
    description: "RPM FEST regresa al Circuito Internacional FK1 con su edición Night Demons.",
    organizer_name: "Diamond Squad Events",
    poster_url: "https://www.instagram.com/rpmfest.official/",
    ...overrides,
  };
}

function reviewedRpmDraft(): EditableEventDraft {
  return {
    ...createEditableEventDraft(rpmSubmission()),
    city: "Villaverde de Medina",
    province: "Valladolid",
    region: "Castilla y León",
    country: "ES",
    discipline: "Otros",
    category: "Otros",
    vehicleType: "mixto",
    organizer: "Diamond Squad Events",
    sourceUrl: SOURCE_URL,
    ticketUrl: TICKET_URL,
    registrationUrl: "",
    posterUrl: "",
    shortDescription:
      "RPM FEST regresa al Circuito Internacional FK1 con su edición Night Demons: una noche de motor, música y espectáculo con drift nocturno, grip, lanzadas, exposiciones de coches y motos y numerosas actividades.",
    longDescription: [
      "RPM FEST – Night Demons se celebrará el 15 de agosto de 2026 en el Circuito Internacional FK1, en Villaverde de Medina, Valladolid.",
      "",
      "El evento tendrá lugar de 18:00 a 02:00 y reunirá en una misma noche a aficionados a los coches, las motos y el mundo del motor.",
      "",
      "La programación incluye drift nocturno, actividades de grip, lanzadas de coches y motos, exposición de vehículos, concurso de escapes, concurso de limbo y juegos y actividades para motos.",
      "",
      "Esta nueva edición se organiza junto al club Night Demons y combinará actividad en pista, música, ambiente de festival y diferentes propuestas para participantes y visitantes.",
      "",
      "Las entradas se encuentran disponibles a través de la plataforma oficial del organizador.",
    ].join("\n"),
    scheduleText: "De 18:00 a 02:00, finalizando durante la madrugada del 16 de agosto.",
    tags: [
      "RPM FEST",
      "Night Demons",
      "Circuito FK1",
      "Villaverde de Medina",
      "Valladolid",
      "drift",
      "grip",
      "coches",
      "motos",
      "festival del motor",
    ],
    status: "pending_review",
  };
}

test("el borrador se precarga y conserva valores aunque la validación falle", () => {
  const draft = createEditableEventDraft(rpmSubmission());
  const validation = validateEditableEventDraft(draft);

  assert.equal(draft.title, "RPM FEST – Night Demons 2026");
  assert.equal(draft.endDate, "2026-08-15");
  assert.equal(draft.ticketUrl, TICKET_URL);
  assert.equal(draft.sourceUrl, SOURCE_URL);
  assert.equal(draft.posterUrl, "");
  assert.equal(validation.fieldErrors.city, "Indica la ciudad del evento.");
  assert.equal(validation.fieldErrors.province, "Indica la provincia del evento.");
  assert.equal(validation.draft.title, draft.title);
  assert.equal(validation.draft.ticketUrl, TICKET_URL);
});

test("corregir ciudad y provincia produce un borrador válido sin perder horario ni URLs", () => {
  const draft = reviewedRpmDraft();
  const validation = validateEditableEventDraft(draft);

  assert.deepEqual(validation.errors, []);
  assert.equal(validation.draft.city, "Villaverde de Medina");
  assert.equal(validation.draft.province, "Valladolid");
  assert.equal(validation.draft.endDate, "2026-08-15");
  assert.match(validation.draft.scheduleText, /02:00/);
  assert.equal(validation.draft.ticketUrl, TICKET_URL);
  assert.equal(validation.draft.sourceUrl, SOURCE_URL);
});

test("editar ciudad y provincia desde el formulario infiere Castilla y León y elimina errores críticos", () => {
  const initial = createEditableEventDraft(rpmSubmission());
  const withCity = updateEditableEventDraft(initial, "city", "Villaverde de Medina");
  const corrected = updateEditableEventDraft(withCity, "province", "Valladolid");
  const validation = validateEditableEventDraft(corrected);

  assert.equal(corrected.region, "Castilla y León");
  assert.equal(validation.fieldErrors.city, undefined);
  assert.equal(validation.fieldErrors.province, undefined);
  assert.deepEqual(validation.errors, []);
});

test("cambiar un campo después de validar invalida la huella anterior", () => {
  const validated = reviewedRpmDraft();
  const fingerprint = eventDraftFingerprint(validated);
  const edited = updateEditableEventDraft(validated, "city", "Otra ciudad");

  assert.equal(isCurrentEventDraftValidated(validated, fingerprint), true);
  assert.equal(isCurrentEventDraftValidated(edited, fingerprint), false);
  assert.equal(edited.status, "pending_review");
});

test("restablecer recupera exactamente el borrador original", () => {
  const original = createEditableEventDraft(rpmSubmission());
  const edited = updateEditableEventDraft(original, "city", "Villaverde de Medina");
  const restored = resetEditableEventDraft(original);

  assert.notDeepEqual(edited, original);
  assert.deepEqual(restored, original);
  assert.notEqual(restored, original);
});

test("la publicación transforma exactamente el borrador validado y excluye datos privados", () => {
  const draft = reviewedRpmDraft();
  const fingerprint = eventDraftFingerprint(draft);
  const payload = publicationDraftToEvent(draft);
  const serialized = JSON.stringify(payload);

  assert.equal(isCurrentEventDraftValidated(draft, fingerprint), true);
  assert.equal(payload.city, "Villaverde de Medina");
  assert.equal(payload.province, "Valladolid");
  assert.equal(payload.end_date, "2026-08-15");
  assert.equal(payload.ticket_url, TICKET_URL);
  assert.equal(payload.registration_url, null);
  assert.equal(payload.schedule_text, draft.scheduleText);
  assert.deepEqual(payload.tags?.slice(0, draft.tags.length), draft.tags);
  assert.doesNotMatch(serialized, /privado@example\.com|611111111|35fcf8a6-1918-429c-aa07-5a4ff99cc6ca/);
});

test("el servidor rechaza campos privados, contenido administrativo y carteles sociales", () => {
  const privateDraft = {
    ...reviewedRpmDraft(),
    contact_email: "privado@example.com",
    contact_phone: "611111111",
    longDescription: `Solicitud origen: ${SUBMISSION_ID}`,
    posterUrl: SOURCE_URL,
  };
  const validation = validateEditableEventDraft(privateDraft);

  assert.match(validation.errors.join(" "), /campos no permitidos/);
  assert.match(validation.fieldErrors.longDescription || "", /Elimina emails, teléfonos, UUID/);
  assert.match(validation.fieldErrors.posterUrl || "", /perfiles sociales/);
});

test("rechaza teléfonos en ticketUrl pero conserva WhatsApp como registrationUrl", () => {
  const validation = validateEditableEventDraft({
    ...reviewedRpmDraft(),
    ticketUrl: "https://tickets.example/611111111",
    registrationUrl: "https://wa.me/34611111111",
  });

  assert.match(validation.fieldErrors.ticketUrl || "", /no puede contener teléfonos/);
  assert.equal(validation.fieldErrors.registrationUrl, undefined);
});

test("editar etiquetas conserva una lista normalizada y no realiza ninguna escritura externa", () => {
  const edited = updateEditableEventDraft(
    reviewedRpmDraft(),
    "tags",
    "RPM FEST\nNight Demons, drift\nRPM FEST",
  );

  assert.deepEqual(edited.tags, ["RPM FEST", "Night Demons", "drift"]);
});
