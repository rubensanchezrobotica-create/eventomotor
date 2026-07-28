import assert from "node:assert/strict";
import test from "node:test";
import {
  EVENT_IMAGE_MAX_BYTES,
  assertMatchingImageSignature,
  createEventImageObjectPath,
  detectImageMimeType,
  requireEventId,
  requireUpdatedAt,
  safeSlugSegment,
  validateEventImageBucketConfig,
  validateImageSourceUrl,
  validateOwnedObjectPath,
  validatePublicEventImageUrl,
  validateUploadIntent,
} from "./admin-event-image-upload";

const validFiles = [
  ["image/jpeg", "cartel.jpg"],
  ["image/png", "cartel.png"],
  ["image/webp", "cartel.webp"],
] as const;

for (const [mime, name] of validFiles) {
  test(`permite ${mime}`, () => {
    assert.equal(validateUploadIntent({
      declaredMimeType: mime,
      originalFileName: name,
      fileSize: 1,
    }).declaredMimeType, mime);
  });
}

for (const [mime, name] of [
  ["image/svg+xml", "cartel.svg"],
  ["image/gif", "cartel.gif"],
  ["application/pdf", "cartel.pdf"],
]) {
  test(`rechaza ${mime}`, () => {
    assert.throws(() => validateUploadIntent({
      declaredMimeType: mime,
      originalFileName: name,
      fileSize: 1,
    }), /JPG, PNG o WebP/);
  });
}

test("rechaza un archivo vacío", () => {
  assert.throws(() => validateUploadIntent({
    declaredMimeType: "image/jpeg",
    originalFileName: "a.jpg",
    fileSize: 0,
  }), /vacío/);
});

test("rechaza un archivo mayor de 5 MB", () => {
  assert.throws(() => validateUploadIntent({
    declaredMimeType: "image/jpeg",
    originalFileName: "a.jpg",
    fileSize: EVENT_IMAGE_MAX_BYTES + 1,
  }), /5 MB/);
});

test("rechaza una extensión incoherente", () => {
  assert.throws(() => validateUploadIntent({
    declaredMimeType: "image/png",
    originalFileName: "a.jpg",
    fileSize: 1,
  }), /extensión/);
});

test("crea una ruta segura, versionada y desligada del nombre original", () => {
  const path = createEventImageObjectPath({
    eventId: "event-1",
    eventSlug: "Rally Costa del Sol",
    mimeType: "image/jpeg",
    now: new Date("2026-07-28T10:00:00Z"),
    uuid: "123e4567-e89b-12d3-a456-426614174000",
  });
  assert.equal(
    path,
    "events/event-1/1785232800000-123e4567-e89b-12d3-a456-426614174000-rally-costa-del-sol.jpg",
  );
});

test("sanitiza el slug", () => {
  assert.equal(safeSlugSegment("  Rally Ávila / ../ 2026 "), "rally-avila-2026");
});

test("rechaza traversal", () => {
  assert.throws(
    () => validateOwnedObjectPath("events/event-1/../evil.jpg", "event-1", "image/jpeg"),
    /ruta/,
  );
});

test("exige que el path pertenezca al evento", () => {
  assert.throws(
    () => validateOwnedObjectPath("events/event-2/file.jpg", "event-1", "image/jpeg"),
    /evento/,
  );
});

test("acepta un path perteneciente al evento", () => {
  assert.equal(
    validateOwnedObjectPath("events/event-1/1-a-file.jpg", "event-1", "image/jpeg"),
    "events/event-1/1-a-file.jpg",
  );
});

test("rechaza eventId inválido", () => {
  assert.throws(() => requireEventId("../event"), /eventId/);
});

test("updated_at es obligatorio", () => {
  assert.throws(() => requireUpdatedAt(""), /obligatorio/);
});

test("updated_at debe ser ISO interpretable", () => {
  assert.throws(() => requireUpdatedAt("ayer"), /no es válido/);
});

test("valida la firma JPEG", () => {
  assert.equal(detectImageMimeType(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
});

test("valida la firma PNG completa", () => {
  assert.equal(
    detectImageMimeType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/png",
  );
});

test("valida la firma WebP", () => {
  assert.equal(
    detectImageMimeType(Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
    ])),
    "image/webp",
  );
});

test("rechaza MIME falso", () => {
  assert.throws(
    () => assertMatchingImageSignature(Uint8Array.from([0xff, 0xd8, 0xff]), "image/png"),
    /no coincide/,
  );
});

test("acepta URL fuente HTTP", () => {
  assert.equal(validateImageSourceUrl("http://example.com/autor"), "http://example.com/autor");
});

test("acepta URL fuente HTTPS", () => {
  assert.equal(validateImageSourceUrl("https://example.com/autor"), "https://example.com/autor");
});

test("rechaza javascript:", () => {
  assert.throws(() => validateImageSourceUrl("javascript:alert(1)"), /HTTP/);
});

test("rechaza data:", () => {
  assert.throws(() => validateImageSourceUrl("data:text/plain,hola"), /HTTP/);
});

test("rechaza credenciales embebidas", () => {
  assert.throws(() => validateImageSourceUrl("https://user:pass@example.com/a"), /credenciales/);
});

test("permite fuente vacía", () => {
  assert.equal(validateImageSourceUrl(""), null);
});

test("valida URL pública exacta", () => {
  const path = "events/event-1/file.jpg";
  assert.equal(
    validatePublicEventImageUrl(
      `https://project.supabase.co/storage/v1/object/public/event-images/${path}`,
      path,
    ),
    `https://project.supabase.co/storage/v1/object/public/event-images/${path}`,
  );
});

test("rechaza URL pública HTTP", () => {
  assert.throws(
    () => validatePublicEventImageUrl(
      "http://project.supabase.co/storage/v1/object/public/event-images/events/event-1/file.jpg",
      "events/event-1/file.jpg",
    ),
    /URL pública/,
  );
});

test("acepta únicamente la configuración exacta del bucket", () => {
  assert.doesNotThrow(() => validateEventImageBucketConfig({
    public: true,
    file_size_limit: EVENT_IMAGE_MAX_BYTES,
    allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
  }));
});

test("rechaza un bucket privado", () => {
  assert.throws(() => validateEventImageBucketConfig({
    public: false,
    file_size_limit: EVENT_IMAGE_MAX_BYTES,
    allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
  }), /configuración/);
});

test("rechaza MIME adicional en el bucket", () => {
  assert.throws(() => validateEventImageBucketConfig({
    public: true,
    file_size_limit: EVENT_IMAGE_MAX_BYTES,
    allowed_mime_types: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
  }), /configuración/);
});
