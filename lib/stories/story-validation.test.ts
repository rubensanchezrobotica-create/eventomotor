import assert from "node:assert/strict";
import test from "node:test";
import {
  STORY_BLOCK_TYPES,
  STORY_COLLECTIONS,
  STORY_CREDIT_ROLES,
  STORY_EVENT_RELATION_TYPES,
  STORY_RIGHTS_TYPES,
  STORY_SCHEMA_VERSION,
  STORY_STATUSES,
  STORY_TYPES,
  STORY_LIMITS,
} from "./story-types";
import {
  isSafeStoryLink,
  isStoryBlockType,
  isStoryCollection,
  isStoryCreditRole,
  isStoryEventRelationType,
  isStoryRightsType,
  isStoryStatus,
  isStoryType,
  isValidStorySlug,
  validateStoryCredits,
  validateStoryDocument,
  validateStoryRecord,
  validateStoryEventRelations,
  validateStoryPublication,
} from "./story-validation";

function paragraph(overrides: Record<string, unknown> = {}) {
  return {
    id: "paragraph-1",
    type: "PARAGRAPH",
    content: [{ type: "TEXT", text: "Una historia del motor." }],
    ...overrides,
  };
}

function validStory(overrides: Record<string, unknown> = {}) {
  return {
    id: "story-opaque-id",
    slug: "una-historia-del-motor",
    status: "READY",
    type: "HISTORIA",
    collection: "HISTORIAS_DE_MOTOR",
    title: "Una historia del motor",
    dek: "Personas, máquinas y memoria contadas desde dentro.",
    contextLocation: "Asturias",
    contentBlocks: [
      paragraph(),
      { id: "image-1", type: "IMAGE", mediaId: "body-media" },
      { id: "event-1", type: "EVENT_REFERENCE", eventId: "opaque-event-id" },
    ],
    heroMediaId: "hero-media",
    seoTitle: "Una historia del motor | EventoMotor",
    seoDescription: "Una historia humana del motor contada por EventoMotor.",
    disciplineSlugs: ["rallyes"],
    territoryIds: ["asturias"],
    publishedAt: null,
    updatedAt: "2026-09-28T12:00:00.000Z",
    homeRank: 1,
    schemaVersion: STORY_SCHEMA_VERSION,
    ...overrides,
  };
}

function validMedia(overrides: Record<string, unknown> = {}) {
  return {
    media: [
      { id: "hero-media", altText: "Un equipo junto a su coche", rightsType: "OWN" },
      { id: "body-media", altText: "Detalle del vehículo", rightsType: "PRESS_PROVIDED" },
    ],
    ...overrides,
  };
}

function resultCodes(result: { errors: readonly { code: string }[] }) {
  return result.errors.map((item) => item.code);
}

function paragraphWithSplitText(totalLength: number) {
  const firstLength = Math.floor(totalLength / 2);
  return paragraph({
    content: [
      { type: "TEXT", text: "a".repeat(firstLength) },
      {
        type: "LINK",
        href: "/historias",
        children: [{ type: "TEXT", text: "b".repeat(totalLength - firstLength) }],
      },
    ],
  });
}

function paragraphBlocksForBodyText(totalLength: number) {
  const blocks: Record<string, unknown>[] = [];
  let remaining = totalLength;
  while (remaining > 0) {
    const textLength = Math.min(remaining, STORY_LIMITS.paragraphText);
    blocks.push(paragraph({
      id: `body-paragraph-${blocks.length}`,
      content: [{ type: "TEXT", text: "x".repeat(textLength) }],
    }));
    remaining -= textLength;
  }
  return blocks;
}

function paragraphBlocksForInlineNodes(totalNodes: number) {
  const blocks: Record<string, unknown>[] = [];
  let remaining = totalNodes;
  while (remaining > 0) {
    const nodeCount = Math.min(remaining, STORY_LIMITS.inlineNodes);
    blocks.push(paragraph({
      id: `nodes-paragraph-${blocks.length}`,
      content: Array.from({ length: nodeCount }, () => ({ type: "TEXT", text: "x" })),
    }));
    remaining -= nodeCount;
  }
  return blocks;
}

test("fija la primera versión del contrato editorial", () => {
  assert.equal(STORY_SCHEMA_VERSION, 1);
  assert.deepEqual(STORY_STATUSES, ["DRAFT", "READY", "PUBLISHED", "ARCHIVED"]);
  assert.deepEqual(STORY_TYPES, ["CRONICA", "REPORTAJE", "HISTORIA", "ENTREVISTA"]);
  assert.deepEqual(STORY_COLLECTIONS, ["DESDE_DENTRO", "HISTORIAS_DE_MOTOR", "CONVERSACIONES"]);
});

test("acepta únicamente los estados previstos", () => {
  for (const value of STORY_STATUSES) assert.equal(isStoryStatus(value), true);
  assert.equal(isStoryStatus("SCHEDULED"), false);
});

test("StoryRecord representa registros en cualquiera de los cuatro estados", () => {
  for (const status of STORY_STATUSES) {
    const result = validateStoryRecord(validStory({ status }));
    assert.equal(result.ok, true, status);
  }
});

test("acepta únicamente los tipos editoriales previstos", () => {
  for (const value of STORY_TYPES) assert.equal(isStoryType(value), true);
  assert.equal(isStoryType("NEWS"), false);
});

test("acepta únicamente las colecciones previstas", () => {
  for (const value of STORY_COLLECTIONS) assert.equal(isStoryCollection(value), true);
  assert.equal(isStoryCollection("ACTUALIDAD"), false);
});

test("acepta únicamente los derechos previstos", () => {
  for (const value of STORY_RIGHTS_TYPES) assert.equal(isStoryRightsType(value), true);
  assert.equal(isStoryRightsType("FAIR_USE"), false);
});

test("acepta únicamente los roles de crédito previstos", () => {
  for (const value of STORY_CREDIT_ROLES) assert.equal(isStoryCreditRole(value), true);
  assert.equal(isStoryCreditRole("EDITOR"), false);
});

test("acepta únicamente las relaciones con eventos previstas", () => {
  for (const value of STORY_EVENT_RELATION_TYPES) assert.equal(isStoryEventRelationType(value), true);
  assert.equal(isStoryEventRelationType("MENTIONED"), false);
});

test("acepta únicamente los siete tipos de bloque", () => {
  for (const value of STORY_BLOCK_TYPES) assert.equal(isStoryBlockType(value), true);
  assert.equal(isStoryBlockType("HTML"), false);
});

test("valida un slug público canónico", () => {
  assert.equal(isValidStorySlug("desde-dentro-2026"), true);
});

test("rechaza mayúsculas y espacios en el slug", () => {
  assert.equal(isValidStorySlug("Desde-Dentro"), false);
  assert.equal(isValidStorySlug("desde dentro"), false);
});

test("rechaza caracteres inseguros y no ASCII en el slug", () => {
  assert.equal(isValidStorySlug("historia<script>"), false);
  assert.equal(isValidStorySlug("história-motor"), false);
});

test("rechaza guiones extremos o dobles", () => {
  assert.equal(isValidStorySlug("-historia"), false);
  assert.equal(isValidStorySlug("historia-"), false);
  assert.equal(isValidStorySlug("historia--motor"), false);
});

test("acepta rutas internas y enlaces HTTP(S)", () => {
  assert.equal(isSafeStoryLink("/evento/rally-de-casares?from=story#mapa"), true);
  assert.equal(isSafeStoryLink("https://www.eventomotor.com/calendario"), true);
  assert.equal(isSafeStoryLink("http://example.com/archivo"), true);
});

test("rechaza protocolos peligrosos y URLs malformadas", () => {
  for (const href of ["javascript:alert(1)", "data:text/html,x", "vbscript:msgbox(1)", "file:///tmp/a", "https://"]) {
    assert.equal(isSafeStoryLink(href), false, href);
  }
});

test("rechaza credenciales embebidas y rutas protocol-relative", () => {
  assert.equal(isSafeStoryLink("https://user:pass@example.com/path"), false);
  assert.equal(isSafeStoryLink("//example.com/path"), false);
});

test("rechaza links vacíos, con espacios o caracteres de control", () => {
  assert.equal(isSafeStoryLink(""), false);
  assert.equal(isSafeStoryLink(" https://example.com"), false);
  assert.equal(isSafeStoryLink("/ruta con espacio"), false);
  assert.equal(isSafeStoryLink("/ruta%0aotra"), false);
});

test("valida texto inline sin marcas", () => {
  const result = validateStoryDocument({ schemaVersion: 1, contentBlocks: [paragraph()] });
  assert.equal(result.ok, true);
});

test("valida bold, italic y su combinación", () => {
  const result = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: [paragraph({
      content: [
        { type: "TEXT", text: "Negrita", marks: ["bold"] },
        { type: "TEXT", text: "Cursiva", marks: ["italic"] },
        { type: "TEXT", text: "Ambas", marks: ["bold", "italic"] },
      ],
    })],
  });
  assert.equal(result.ok, true);
});

test("rechaza una marca inline desconocida", () => {
  const result = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: [paragraph({ content: [{ type: "TEXT", text: "Texto", marks: ["underline"] }] })],
  });
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("UNKNOWN_ENUM_VALUE"));
});

test("valida links internos, HTTPS y HTTP dentro de un párrafo", () => {
  const result = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: [paragraph({
      content: ["/calendario", "https://example.com", "http://example.com"].map((href) => ({
        type: "LINK",
        href,
        children: [{ type: "TEXT", text: "Destino" }],
      })),
    })],
  });
  assert.equal(result.ok, true);
});

test("rechaza links javascript, data y con credenciales dentro de bloques", () => {
  for (const href of ["javascript:alert(1)", "data:text/html,x", "https://user:pass@example.com"]) {
    const result = validateStoryDocument({
      schemaVersion: 1,
      contentBlocks: [paragraph({
        content: [{ type: "LINK", href, children: [{ type: "TEXT", text: "Destino" }] }],
      })],
    });
    assert.equal(result.ok, false, href);
    assert.ok(resultCodes(result).includes("UNSAFE_LINK"), href);
  }
});

test("valida todos los tipos de bloque aprobados", () => {
  const result = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: [
      paragraph(),
      { id: "h2", type: "HEADING", level: 2, text: "La salida" },
      { id: "image", type: "IMAGE", mediaId: "media-1" },
      { id: "pair", type: "IMAGE_PAIR", mediaIds: ["media-1", "media-2"] },
      { id: "gallery", type: "GALLERY", mediaIds: ["media-1", "media-2"] },
      { id: "quote", type: "PULL_QUOTE", text: "El motor también es memoria.", attribution: "EventoMotor" },
      { id: "event", type: "EVENT_REFERENCE", eventId: "opaque-event-key" },
    ],
  });
  assert.equal(result.ok, true);
});

test("rechaza bloques de tipo desconocido", () => {
  const result = validateStoryDocument({ schemaVersion: 1, contentBlocks: [{ id: "x", type: "HTML", html: "<b>x</b>" }] });
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("UNKNOWN_ENUM_VALUE"));
});

test("rechaza IDs de bloque vacíos y duplicados", () => {
  const result = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: [paragraph({ id: "" }), paragraph(), paragraph()],
  });
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("REQUIRED_VALUE"));
  assert.ok(resultCodes(result).includes("DUPLICATE_BLOCK_ID"));
});

test("rechaza párrafos vacíos", () => {
  const result = validateStoryDocument({ schemaVersion: 1, contentBlocks: [paragraph({ content: [] })] });
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("EMPTY_PARAGRAPH"));
});

test("el texto agregado de un párrafo acepta valores bajo y exactamente en el límite", () => {
  const under = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: [paragraphWithSplitText(STORY_LIMITS.paragraphText - 1)],
  });
  const exact = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: [paragraphWithSplitText(STORY_LIMITS.paragraphText)],
  });
  assert.equal(under.ok, true);
  assert.equal(exact.ok, true);
});

test("el límite de párrafo suma TEXT y los TEXT hijos de LINK", () => {
  const block = paragraphWithSplitText(STORY_LIMITS.paragraphText + 1);
  const result = validateStoryDocument({ schemaVersion: 1, contentBlocks: [block] });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => (
    item.code === "LIMIT_EXCEEDED" && item.field === "contentBlocks[0].content"
  )));
  const content = block.content as Array<{ text?: string; children?: Array<{ text: string }> }>;
  const originalLength = content.reduce((total, node) => (
    total + (node.text?.length ?? 0) + (node.children?.reduce((sum, child) => sum + child.text.length, 0) ?? 0)
  ), 0);
  assert.equal(originalLength, STORY_LIMITS.paragraphText + 1);
});

test("el texto agregado del body acepta valores bajo y exactamente en el límite", () => {
  const fixedTextLength = STORY_LIMITS.heading + STORY_LIMITS.quote + STORY_LIMITS.quoteAttribution;
  const exactBlocks = [
    ...paragraphBlocksForBodyText(STORY_LIMITS.storyBodyText - fixedTextLength),
    { id: "body-heading", type: "HEADING", level: 2, text: "h".repeat(STORY_LIMITS.heading) },
    {
      id: "body-quote",
      type: "PULL_QUOTE",
      text: "q".repeat(STORY_LIMITS.quote),
      attribution: "a".repeat(STORY_LIMITS.quoteAttribution),
    },
  ];
  const under = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: [
      ...paragraphBlocksForBodyText(STORY_LIMITS.storyBodyText - fixedTextLength - 1),
      ...exactBlocks.slice(-2),
    ],
  });
  const exact = validateStoryDocument({ schemaVersion: 1, contentBlocks: exactBlocks });
  assert.equal(under.ok, true);
  assert.equal(exact.ok, true);
});

test("varios bloques que superan el texto total del body fallan cerrados", () => {
  const blocks = [
    ...paragraphBlocksForBodyText(STORY_LIMITS.storyBodyText),
    { id: "body-overflow-heading", type: "HEADING", level: 2, text: "x" },
  ];
  const result = validateStoryDocument({ schemaVersion: 1, contentBlocks: blocks });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.code === "LIMIT_EXCEEDED" && item.field === "contentBlocks"));
});

test("el total inline cuenta TEXT y LINK más sus hijos estructurales", () => {
  const under = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: paragraphBlocksForInlineNodes(STORY_LIMITS.totalInlineNodes - 1),
  });
  const exact = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: paragraphBlocksForInlineNodes(STORY_LIMITS.totalInlineNodes),
  });
  const over = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: paragraphBlocksForInlineNodes(STORY_LIMITS.totalInlineNodes + 1),
  });
  assert.equal(under.ok, true);
  assert.equal(exact.ok, true);
  assert.equal(over.ok, false);
  assert.ok(over.errors.some((item) => item.code === "LIMIT_EXCEEDED" && item.field === "contentBlocks"));

  const linkOverflow = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: [
      ...paragraphBlocksForInlineNodes(STORY_LIMITS.totalInlineNodes - 2),
      paragraph({
        id: "link-structural-count",
        content: [{
          type: "LINK",
          href: "/historias",
          children: [{ type: "TEXT", text: "uno" }, { type: "TEXT", text: "dos" }],
        }],
      }),
    ],
  });
  assert.equal(linkOverflow.ok, false);
  assert.ok(linkOverflow.errors.some((item) => item.code === "LIMIT_EXCEEDED"));
});

test("rechaza heading vacío, H1 y H4", () => {
  for (const level of [1, 4]) {
    const result = validateStoryDocument({
      schemaVersion: 1,
      contentBlocks: [{ id: `h-${level}`, type: "HEADING", level, text: "" }],
    });
    assert.equal(result.ok, false);
    assert.ok(resultCodes(result).includes("INVALID_HEADING_LEVEL"));
    assert.ok(resultCodes(result).includes("REQUIRED_VALUE"));
  }
});

test("rechaza IMAGE sin mediaId", () => {
  const result = validateStoryDocument({ schemaVersion: 1, contentBlocks: [{ id: "image", type: "IMAGE", mediaId: "" }] });
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("REQUIRED_VALUE"));
});

test("IMAGE_PAIR exige exactamente dos IDs diferentes", () => {
  for (const mediaIds of [["one"], ["one", "two", "three"], ["same", "same"]]) {
    const result = validateStoryDocument({ schemaVersion: 1, contentBlocks: [{ id: "pair", type: "IMAGE_PAIR", mediaIds }] });
    assert.equal(result.ok, false);
    assert.ok(resultCodes(result).includes("INVALID_IMAGE_PAIR"));
  }
});

test("GALLERY acepta entre 2 y 30 IDs ordenados", () => {
  const min = validateStoryDocument({ schemaVersion: 1, contentBlocks: [{ id: "g", type: "GALLERY", mediaIds: ["a", "b"] }] });
  const max = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: [{ id: "g", type: "GALLERY", mediaIds: Array.from({ length: 30 }, (_, index) => `m-${index}`) }],
  });
  assert.equal(min.ok, true);
  assert.equal(max.ok, true);
});

test("GALLERY rechaza menos de 2, más de 30, vacíos y duplicados", () => {
  const cases = [
    ["one"],
    Array.from({ length: 31 }, (_, index) => `m-${index}`),
    ["one", ""],
    ["same", "same"],
  ];
  for (const mediaIds of cases) {
    const result = validateStoryDocument({ schemaVersion: 1, contentBlocks: [{ id: "g", type: "GALLERY", mediaIds }] });
    assert.equal(result.ok, false);
  }
});

test("rechaza PULL_QUOTE vacío", () => {
  const result = validateStoryDocument({ schemaVersion: 1, contentBlocks: [{ id: "quote", type: "PULL_QUOTE", text: "" }] });
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("REQUIRED_VALUE"));
});

test("EVENT_REFERENCE acepta un eventId opaco sin imponer UUID", () => {
  const result = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: [{ id: "event", type: "EVENT_REFERENCE", eventId: "legacy:event/2026#opaque" }],
  });
  assert.equal(result.ok, true);
});

test("EVENT_REFERENCE rechaza eventId vacío", () => {
  const result = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: [{ id: "event", type: "EVENT_REFERENCE", eventId: "" }],
  });
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("REQUIRED_VALUE"));
});

test("EVENT_REFERENCE no duplica relación, URL ni metadata del evento", () => {
  const result = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: [{
      id: "event",
      type: "EVENT_REFERENCE",
      eventId: "opaque-event-key",
      relationType: "PRIMARY",
      url: "/eventos/duplicado",
      title: "Título duplicado",
      slug: "slug-duplicado",
    }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors.filter((item) => item.code === "UNKNOWN_FIELD").length, 4);
});

test("rechaza schemaVersion no soportada", () => {
  const result = validateStoryDocument({ schemaVersion: 2, contentBlocks: [paragraph()] });
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("UNSUPPORTED_SCHEMA_VERSION"));
});

test("rechaza raw HTML y atributos arbitrarios en cualquier nodo", () => {
  const result = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: [paragraph({
      html: "<script>alert(1)</script>",
      content: [{ type: "TEXT", text: "Seguro", onclick: "alert(1)", style: "color:red" }],
    })],
  });
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("UNKNOWN_FIELD"));
});

test("rechaza taxonomía vacía o duplicada sin validar aún el catálogo", () => {
  const result = validateStoryRecord(validStory({
    disciplineSlugs: ["rallyes", "rallyes"],
    territoryIds: [""],
  }));
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("DUPLICATE_VALUE"));
  assert.ok(resultCodes(result).includes("REQUIRED_VALUE"));
});

test("modela múltiples créditos con roles y orden", () => {
  const result = validateStoryCredits([
    { personId: "person-1", role: "TEXT", sortOrder: 0 },
    { personId: "person-2", role: "PHOTO", sortOrder: 1 },
  ]);
  assert.equal(result.ok, true);
});

test("rechaza créditos duplicados, roles desconocidos y atributos extra", () => {
  const result = validateStoryCredits([
    { personId: "person-1", role: "TEXT", sortOrder: 0 },
    { personId: "person-1", role: "TEXT", sortOrder: 1 },
    { personId: "person-2", role: "EDITOR", sortOrder: 2, html: "x" },
  ]);
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("DUPLICATE_VALUE"));
  assert.ok(resultCodes(result).includes("UNKNOWN_ENUM_VALUE"));
  assert.ok(resultCodes(result).includes("UNKNOWN_FIELD"));
});

test("modela relaciones PRIMARY y RELATED con eventId opaco", () => {
  const result = validateStoryEventRelations([
    { eventId: "not-a-uuid", relationType: "PRIMARY", sortOrder: 0 },
    { eventId: "another:event", relationType: "RELATED", sortOrder: 1 },
  ]);
  assert.equal(result.ok, true);
});

test("rechaza relaciones duplicadas o con evento vacío", () => {
  const result = validateStoryEventRelations([
    { eventId: "event-1", relationType: "PRIMARY", sortOrder: 0 },
    { eventId: "event-1", relationType: "RELATED", sortOrder: 1 },
    { eventId: "", relationType: "RELATED", sortOrder: 2 },
  ]);
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("DUPLICATE_VALUE"));
  assert.ok(resultCodes(result).includes("REQUIRED_VALUE"));
});

test("una Historia completa supera el publication gate", () => {
  const result = validateStoryPublication(validStory(), validMedia());
  assert.deepEqual(result, { ok: true, errors: [] });
});

test("sólo READY puede superar el publication gate", () => {
  for (const status of ["DRAFT", "PUBLISHED", "ARCHIVED"]) {
    const result = validateStoryPublication(validStory({ status }), validMedia());
    assert.equal(result.ok, false);
    assert.ok(resultCodes(result).includes("STATUS_NOT_READY"));
  }
});

test("title vacío bloquea publicación", () => {
  const result = validateStoryPublication(validStory({ title: "" }), validMedia());
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("TITLE_REQUIRED"));
});

test("dek vacía bloquea publicación", () => {
  const result = validateStoryPublication(validStory({ dek: "" }), validMedia());
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("DEK_REQUIRED"));
});

test("hero ausente bloquea publicación", () => {
  const result = validateStoryPublication(validStory({ heroMediaId: "" }), validMedia());
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("HERO_REQUIRED"));
});

test("hero sin metadata bloquea publicación", () => {
  const result = validateStoryPublication(validStory(), validMedia({ media: [] }));
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("HERO_MEDIA_NOT_FOUND"));
});

test("hero UNKNOWN bloquea publicación", () => {
  const result = validateStoryPublication(validStory(), validMedia({
    media: [
      { id: "hero-media", altText: "Hero", rightsType: "UNKNOWN" },
      { id: "body-media", altText: "Body", rightsType: "OWN" },
    ],
  }));
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("HERO_RIGHTS_UNKNOWN"));
});

test("hero sin alt bloquea publicación", () => {
  const result = validateStoryPublication(validStory(), validMedia({
    media: [
      { id: "hero-media", altText: "", rightsType: "OWN" },
      { id: "body-media", altText: "Body", rightsType: "OWN" },
    ],
  }));
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("HERO_ALT_REQUIRED"));
});

test("body vacío bloquea publicación", () => {
  const result = validateStoryPublication(validStory({ contentBlocks: [] }), validMedia());
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("CONTENT_REQUIRED"));
});

test("media de bloque sin metadata bloquea publicación", () => {
  const result = validateStoryPublication(validStory(), validMedia({
    media: [{ id: "hero-media", altText: "Hero", rightsType: "OWN" }],
  }));
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("MEDIA_NOT_FOUND"));
});

test("media de bloque UNKNOWN bloquea publicación", () => {
  const result = validateStoryPublication(validStory(), validMedia({
    media: [
      { id: "hero-media", altText: "Hero", rightsType: "OWN" },
      { id: "body-media", altText: "Body", rightsType: "UNKNOWN" },
    ],
  }));
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("MEDIA_RIGHTS_UNKNOWN"));
});

test("media de bloque sin alt bloquea publicación", () => {
  const result = validateStoryPublication(validStory(), validMedia({
    media: [
      { id: "hero-media", altText: "Hero", rightsType: "OWN" },
      { id: "body-media", altText: "", rightsType: "OWN" },
    ],
  }));
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("MEDIA_ALT_REQUIRED"));
});

test("SEO title y description son obligatorios para publicar", () => {
  const result = validateStoryPublication(validStory({ seoTitle: "", seoDescription: "" }), validMedia());
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("SEO_TITLE_REQUIRED"));
  assert.ok(resultCodes(result).includes("SEO_DESCRIPTION_REQUIRED"));
});

test("schema no soportada bloquea publicación", () => {
  const result = validateStoryPublication(validStory({ schemaVersion: 2 }), validMedia());
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("UNSUPPORTED_SCHEMA_VERSION"));
});

test("un link inseguro bloquea publicación", () => {
  const result = validateStoryPublication(validStory({
    contentBlocks: [paragraph({
      content: [{ type: "LINK", href: "javascript:alert(1)", children: [{ type: "TEXT", text: "Abrir" }] }],
    })],
  }), validMedia());
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("UNSAFE_LINK"));
});

test("inputs desconocidos o malformados fallan cerrados", () => {
  for (const input of [null, [], "story", { arbitrary: true }]) {
    assert.equal(validateStoryPublication(input, validMedia()).ok, false);
  }
  assert.equal(validateStoryPublication(validStory(), null).ok, false);
  assert.equal(validateStoryPublication(validStory(), { media: "not-an-array" }).ok, false);
});

test("no normaliza silenciosamente un StoryRecord inseguro hasta hacerlo válido", () => {
  const input = validStory({
    slug: " Historia Insegura ",
    contentBlocks: [paragraph({ html: "<b>Contenido</b>" })],
  });
  const result = validateStoryRecord(input);
  assert.equal(result.ok, false);
  assert.ok(resultCodes(result).includes("SLUG_INVALID"));
  assert.ok(resultCodes(result).includes("UNKNOWN_FIELD"));
  assert.equal((input as { slug: string }).slug, " Historia Insegura ");
});
