import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  EVENT_SUBMISSION_FIELD_NAMES,
  buildEventSubmissionPayload,
  claimSubmissionLock,
  postEventSubmission,
  releaseSubmissionLock,
} from "./event-submission-client";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const page = source("app/publicar-evento/page.tsx");
const form = source("components/public/EventSubmissionForm.tsx");
const client = source("components/public/event-submission-client.ts");
const styles = source("components/public/PublicarEventoV2.module.css");
const api = source("app/api/event-submissions/route.ts");
const layout = source("app/layout.tsx");
const sitemap = source("app/sitemap.ts");

const visibleFields = [
  "event_name",
  "start_date",
  "end_date",
  "city",
  "province",
  "venue",
  "discipline",
  "vehicle_type",
  "source_url",
  "ticket_url",
  "poster_url",
  "description",
  "organizer_name",
  "contact_email",
  "contact_phone",
] as const;

test("A8B converge la ruta pública al shell V2 sin crear una ruta Preview", () => {
  assert.match(page, /<V2InteriorShell/);
  assert.match(page, /navigationMode="public"/);
  assert.match(page, /currentNavigationId="publish"/);
  assert.match(page, /title="Publica tu evento"/);
  assert.match(page, /eyebrow="Envía tu evento"/);
  assert.doesNotMatch(page, /ConceptStyles|ConceptStaticHeader|ConceptFooter/);
  assert.doesNotMatch(page + form + styles, /href=["'{][^\n]*preview\/redesign-v2/);
});

test("A8B conserva 15 campos visibles, tres obligatorios y el honeypot", () => {
  const formNames = [...form.matchAll(/name="([a-z_]+)"/g)].map((match) => match[1]);
  assert.deepEqual(formNames.sort(), [...visibleFields, "website"].sort());
  assert.deepEqual([...EVENT_SUBMISSION_FIELD_NAMES], [...visibleFields, "website"]);
  assert.equal((form.match(/\brequired\b/g) || []).length, 3);
  assert.match(form, /name="event_name"[^>]*required/);
  assert.match(form, /name="source_url"[^>]*required/);
  assert.match(form, /name="contact_email"[^>]*required/);
  assert.match(form, /name="website"[^>]*tabIndex=\{-1\}/);
  assert.match(form, /className=\{styles\.honeypot\}/);
});

test("A8B agrupa el formulario en cinco secciones semánticas", () => {
  assert.equal((form.match(/<fieldset\b/g) || []).length, 5);
  assert.equal((form.match(/<legend\b/g) || []).length, 5);
  for (const heading of ["Evento", "Fecha y lugar", "Información oficial", "Contacto", "Revisión y envío"]) {
    assert.match(form, new RegExp(`>${heading}<`));
  }
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(styles, /min-height:\s*48px/);
});

test("A8B conserva SEO, indexabilidad y sitemap de /publicar-evento", () => {
  assert.match(page, /title:\s*"Publicar evento de motor gratis"/);
  assert.match(page, /canonical:\s*`\$\{SITE_URL\}\/publicar-evento`/);
  assert.match(layout, /title:\s*\{[\s\S]*?template:\s*`%s \| \$\{SITE_NAME\}`/);
  assert.match(layout, /robots:\s*\{[\s\S]*?index:\s*true,[\s\S]*?follow:\s*true/);
  assert.match(sitemap, /sitemapEntry\("\/publicar-evento", now, "weekly", 0\.6\)/);
});

test("A8B conserva exactamente el payload plano de 16 claves", () => {
  const data = new FormData();
  for (const [index, field] of EVENT_SUBMISSION_FIELD_NAMES.entries()) {
    data.set(field, `valor-${index}`);
  }
  const payload = buildEventSubmissionPayload(data);
  assert.deepEqual(Object.keys(payload), [...EVENT_SUBMISSION_FIELD_NAMES]);
  assert.deepEqual(
    payload,
    Object.fromEntries(EVENT_SUBMISSION_FIELD_NAMES.map((field, index) => [field, `valor-${index}`])),
  );
  assert.equal(EVENT_SUBMISSION_FIELD_NAMES.length, 16);
});

test("A8B envía una sola petición al endpoint existente con el payload intacto", async () => {
  const data = new FormData();
  for (const field of EVENT_SUBMISSION_FIELD_NAMES) data.set(field, field);
  const payload = buildEventSubmissionPayload(data);
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const outcome = await postEventSubmission(payload, async (input, init) => {
    calls.push({ input: String(input), init });
    return new Response(JSON.stringify({ ok: true, message: "Solicitud recibida" }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, "/api/event-submissions");
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(calls[0].init?.headers && (calls[0].init.headers as Record<string, string>)["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), payload);
  assert.deepEqual(outcome, { status: "success", message: "Solicitud recibida" });
});

test("A8B normaliza 400, 429, 500 y fallo de red sin perder errores de campo", async (t) => {
  const data = new FormData();
  const payload = buildEventSubmissionPayload(data);

  await t.test("400", async () => {
    const outcome = await postEventSubmission(payload, async () => new Response(JSON.stringify({
      ok: false,
      error: "Revisa los campos indicados.",
      fields: { event_name: "Campo obligatorio" },
    }), { status: 400 }));
    assert.deepEqual(outcome, {
      status: "error",
      message: "Revisa los campos indicados.",
      fields: { event_name: "Campo obligatorio" },
    });
  });

  await t.test("429", async () => {
    const outcome = await postEventSubmission(payload, async () => new Response(JSON.stringify({
      ok: false,
      error: "Demasiadas solicitudes.",
    }), { status: 429 }));
    assert.equal(outcome.message, "Demasiadas solicitudes.");
  });

  await t.test("500 sin JSON", async () => {
    const outcome = await postEventSubmission(payload, async () => new Response("", { status: 500 }));
    assert.deepEqual(outcome, { status: "error", message: "No se ha podido enviar el evento.", fields: undefined });
  });

  await t.test("red", async () => {
    const outcome = await postEventSubmission(payload, async () => {
      throw new Error("offline");
    });
    assert.match(outcome.message, /Revisa tu conexión/);
  });
});

test("A8B impide el doble submit síncrono y libera el candado al terminar", () => {
  const lock = { current: false };
  assert.equal(claimSubmissionLock(lock), true);
  assert.equal(claimSubmissionLock(lock), false);
  releaseSubmissionLock(lock);
  assert.equal(claimSubmissionLock(lock), true);
});

test("A8B mantiene reset tras éxito, valores tras error y semántica pending", () => {
  assert.match(form, /if \(outcome\.status === "success"\) form\.reset\(\)/);
  assert.doesNotMatch(form, /form\.reset\(\)[\s\S]*?outcome\.status === "error"/);
  assert.match(form, /HEMOS RECIBIDO TU EVENTO/);
  assert.match(form, /Lo revisaremos antes de incorporarlo a la agenda/);
  assert.match(form, /El envío no publica el evento automáticamente\. Quedará pendiente de revisión\./);
  assert.doesNotMatch(form, /publicado automáticamente|ver tu evento|editar tu evento/i);
});

test("A8B asocia errores, anuncia estados y mueve el foco sin sobre-ARIA", () => {
  assert.match(form, /aria-describedby/);
  assert.match(form, /aria-invalid/);
  assert.match(form, /aria-live="assertive"/);
  assert.match(form, /aria-live="polite"/);
  assert.match(form, /aria-busy=\{isSubmitting\}/);
  assert.match(form, /statusRef\.current\?\.focus\(\)/);
  assert.match(form, /control\.focus\(\)/);
  assert.match(form, /disabled=\{isSubmitting\}/);
});

test("A8B no altera el contrato backend ni introduce upload", () => {
  assert.match(api, /\.from\("event_submissions"\)/);
  assert.match(api, /status:\s*"pending"/);
  assert.match(api, /notifyEventSubmission/);
  assert.doesNotMatch(form + client + page, /FormData\([^)]*file|type="file"|supabase\.storage|upload/i);
  assert.match(form, /name="poster_url"/);
  assert.match(form, /este formulario no admite archivos/);
});
