import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  isNewsletterPreviewAvailable,
  NEWSLETTER_PREVIEW_METADATA,
  parseNewsletterPreviewOptions,
  validateNewsletterPreviewForm,
} from "./newsletter-preview-model";

const projectRoot = process.cwd();

function source(path: string): string {
  return readFileSync(join(projectRoot, path), "utf8");
}

function walkFiles(path: string): string[] {
  const absolute = join(projectRoot, path);
  return readdirSync(absolute).flatMap((name) => {
    const child = join(absolute, name);
    return statSync(child).isDirectory() ? walkFiles(join(path, name)) : [child];
  });
}

test("la guardia exige preview y bloquea producción", () => {
  assert.equal(isNewsletterPreviewAvailable(undefined, undefined, "development"), false);
  assert.equal(isNewsletterPreviewAvailable("off", undefined, "development"), false);
  assert.equal(isNewsletterPreviewAvailable("live", "preview", "production"), false);
  assert.equal(isNewsletterPreviewAvailable("preview", "production", "production"), false);
  assert.equal(isNewsletterPreviewAvailable("preview", undefined, "production"), false);
  assert.equal(isNewsletterPreviewAvailable("preview", undefined, "development"), true);
  assert.equal(isNewsletterPreviewAvailable("preview", "preview", "production"), true);
});

test("la metadata bloquea indexación y la ruta usa la convención segura", () => {
  assert.deepEqual(NEWSLETTER_PREVIEW_METADATA.robots, {
    index: false,
    follow: false,
    noarchive: true,
    googleBot: { index: false, follow: false, noarchive: true },
  });
  assert.equal(NEWSLETTER_PREVIEW_METADATA.referrer, "no-referrer");
  const layout = source("app/preview/newsletter/layout.tsx");
  assert.match(layout, /await connection\(\)/);
  assert.match(layout, /process\.env\.NEWSLETTER_MODE/);
  assert.match(layout, /process\.env\.VERCEL_ENV/);
  assert.match(layout, /notFound\(\)/);
});

test("la preview no se publica en sitemap ni navegación", () => {
  assert.doesNotMatch(source("app/sitemap.ts"), /preview\/newsletter/);
  const publicComponents = walkFiles("components/public")
    .filter((path) => /\.(?:ts|tsx)$/.test(path))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  assert.doesNotMatch(publicComponents, /\/preview\/newsletter/);
});

test("la validación devuelve errores genéricos sin enumerar direcciones", () => {
  assert.equal(validateNewsletterPreviewForm("correo-invalido", "barcelona"), "invalid_email");
  assert.equal(validateNewsletterPreviewForm("preview@example.test", ""), "missing_province");
  assert.equal(validateNewsletterPreviewForm("preview@example.test", "barcelona"), null);

  const form = source("components/newsletter/NewsletterSignupForm.tsx");
  assert.match(form, /state === "submitting"/);
  assert.match(form, /accepted:/);
  assert.match(form, /generic_error/);
  assert.match(form, /Solicitud recibida/);
  assert.doesNotMatch(form, /Revisa tu correo|Te hemos enviado un enlace/);
  assert.doesNotMatch(form, /ya (?:existe|está registrada|estaba registrada)/i);
});

test("el laboratorio visual conserva estados simulados sin persistencia cliente", () => {
  const form = source("components/newsletter/NewsletterSignupForm.tsx");
  assert.doesNotMatch(form, /\bfetch\s*\(/);
  assert.doesNotMatch(form, /localStorage|sessionStorage|console\.|analytics|supabase|resend/i);
  assert.match(form, /variant === "lab"/);
  assert.match(form, /NewsletterSignupLab/);
  assert.match(form, /NEWSLETTER_PREVIEW_FORM_STATES\.map/);
});

test("los parámetros de laboratorio sólo aceptan opciones conocidas", () => {
  assert.deepEqual(parseNewsletterPreviewOptions({
    email: "weekly",
    emailViewport: "mobile",
    formState: "generic_error",
  }), {
    emailKind: "weekly",
    emailViewport: "mobile",
    formState: "generic_error",
  });
  assert.deepEqual(parseNewsletterPreviewOptions({
    email: "otro",
    emailViewport: "tablet",
    formState: "unknown",
  }), {
    emailKind: "confirmation",
    emailViewport: "desktop",
    formState: "idle",
  });
});

test("el alcance no contiene endpoints ni integraciones externas", () => {
  const scopedFiles = [
    ...walkFiles("components/newsletter"),
    ...walkFiles("emails/newsletter"),
    join(projectRoot, "app/preview/newsletter/page.tsx"),
    join(projectRoot, "lib/newsletter/render-email.server.tsx"),
  ];
  const scopedSource = scopedFiles
    .filter((path) => /\.(?:ts|tsx)$/.test(path) && !path.endsWith(".test.ts"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  assert.doesNotMatch(scopedSource, /@supabase|createClient|resend|sendEmail|\.send\(/i);
  assert.equal(scopedFiles.some((path) => path.includes(`${join("app", "api")}\\`)), false);
});

test("la capa visual contiene cortes responsive y affordances accesibles", () => {
  const css = source("components/newsletter/NewsletterPreview.module.css");
  for (const width of [1100, 820, 640, 430]) assert.match(css, new RegExp(`max-width: ${width}px`));
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /overflow-x: clip/);
  assert.match(source("components/newsletter/NewsletterEmailShowcase.tsx"), /sandbox=""/);
  assert.doesNotMatch(source("components/newsletter/NewsletterEmailShowcase.tsx"), /dangerouslySetInnerHTML/);
});
