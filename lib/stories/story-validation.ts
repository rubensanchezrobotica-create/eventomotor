import {
  STORY_BLOCK_TYPES,
  STORY_COLLECTIONS,
  STORY_CREDIT_ROLES,
  STORY_EVENT_RELATION_TYPES,
  STORY_INLINE_MARKS,
  STORY_LIMITS,
  STORY_RIGHTS_TYPES,
  STORY_SCHEMA_VERSION,
  STORY_STATUSES,
  STORY_TYPES,
  type StoryBlockType,
  type StoryCollection,
  type StoryContentBlock,
  type StoryCredit,
  type StoryCreditRole,
  type StoryDocument,
  type StoryRecord,
  type StoryEventRelation,
  type StoryEventRelationType,
  type StoryInlineMark,
  type StoryMediaValidationRecord,
  type StoryPublicationContext,
  type StoryPublicationGateResult,
  type StoryRightsType,
  type StoryStatus,
  type StoryType,
  type StoryValidationError,
  type StoryValidationErrorCode,
  type StoryValidationResult,
} from "./story-types";

type UnknownRecord = Record<string, unknown>;

type StoryBodyMetrics = {
  textLength: number;
  inlineNodeCount: number;
};

const EMPTY_BODY_METRICS: StoryBodyMetrics = {
  textLength: 0,
  inlineNodeCount: 0,
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function includesLiteral<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && values.includes(value as T);
}

export function isStoryStatus(value: unknown): value is StoryStatus {
  return includesLiteral(STORY_STATUSES, value);
}

export function isStoryType(value: unknown): value is StoryType {
  return includesLiteral(STORY_TYPES, value);
}

export function isStoryCollection(value: unknown): value is StoryCollection {
  return includesLiteral(STORY_COLLECTIONS, value);
}

export function isStoryRightsType(value: unknown): value is StoryRightsType {
  return includesLiteral(STORY_RIGHTS_TYPES, value);
}

export function isStoryCreditRole(value: unknown): value is StoryCreditRole {
  return includesLiteral(STORY_CREDIT_ROLES, value);
}

export function isStoryEventRelationType(value: unknown): value is StoryEventRelationType {
  return includesLiteral(STORY_EVENT_RELATION_TYPES, value);
}

export function isStoryBlockType(value: unknown): value is StoryBlockType {
  return includesLiteral(STORY_BLOCK_TYPES, value);
}

export function isStoryInlineMark(value: unknown): value is StoryInlineMark {
  return includesLiteral(STORY_INLINE_MARKS, value);
}

function error(
  errors: StoryValidationError[],
  code: StoryValidationErrorCode,
  field: string,
  message: string,
  blockId?: string,
) {
  errors.push({ code, field, message, ...(blockId ? { blockId } : {}) });
}

function rejectUnknownFields(
  value: UnknownRecord,
  allowed: readonly string[],
  field: string,
  errors: StoryValidationError[],
  blockId?: string,
) {
  const allowedFields = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedFields.has(key)) {
      error(errors, "UNKNOWN_FIELD", `${field}.${key}`, `El campo ${key} no está permitido.`, blockId);
    }
  }
}

function validateString(
  value: unknown,
  field: string,
  max: number,
  errors: StoryValidationError[],
  options: { required?: boolean; blockId?: string } = {},
) {
  if (typeof value !== "string") {
    error(errors, "EXPECTED_STRING", field, "Se esperaba texto.", options.blockId);
    return null;
  }
  if (options.required && !value.trim()) {
    error(errors, "REQUIRED_VALUE", field, "El valor no puede estar vacío.", options.blockId);
  }
  if (value.length > max) {
    error(errors, "LIMIT_EXCEEDED", field, `El texto supera el máximo de ${max} caracteres.`, options.blockId);
  }
  return value;
}

function validateNonNegativeInteger(
  value: unknown,
  field: string,
  errors: StoryValidationError[],
) {
  if (!Number.isInteger(value) || (value as number) < 0) {
    error(errors, "EXPECTED_INTEGER", field, "Se esperaba un entero no negativo.");
    return null;
  }
  return value as number;
}

function validateEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  field: string,
  errors: StoryValidationError[],
) {
  if (!includesLiteral(values, value)) {
    error(errors, "UNKNOWN_ENUM_VALUE", field, "El valor no pertenece al contrato permitido.");
    return null;
  }
  return value;
}

function uniqueErrors(errors: readonly StoryValidationError[]) {
  const seen = new Set<string>();
  return errors.filter((item) => {
    const key = `${item.code}\u0000${item.field}\u0000${item.blockId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function isValidStorySlug(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= STORY_LIMITS.slug &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function isSafeStoryLink(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !value ||
    value !== value.trim() ||
    value.length > STORY_LIMITS.href ||
    /[\u0000-\u001f\u007f\s]/.test(value) ||
    /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)
  ) {
    return false;
  }

  if (value.startsWith("/")) {
    if (value.startsWith("//") || value.includes("\\")) return false;
    try {
      return new URL(value, "https://eventomotor.invalid").origin === "https://eventomotor.invalid";
    } catch {
      return false;
    }
  }

  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function validateMarks(
  value: unknown,
  field: string,
  errors: StoryValidationError[],
  blockId: string,
) {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    error(errors, "EXPECTED_ARRAY", field, "Las marcas inline deben ser una lista.", blockId);
    return;
  }
  const seen = new Set<string>();
  value.forEach((mark, index) => {
    if (!isStoryInlineMark(mark)) {
      error(errors, "UNKNOWN_ENUM_VALUE", `${field}[${index}]`, "La marca inline no está permitida.", blockId);
      return;
    }
    if (seen.has(mark)) {
      error(errors, "DUPLICATE_VALUE", `${field}[${index}]`, "La marca inline está duplicada.", blockId);
    }
    seen.add(mark);
  });
}

function validateTextNode(
  value: unknown,
  field: string,
  errors: StoryValidationError[],
  blockId: string,
) {
  if (!isRecord(value)) {
    error(errors, "EXPECTED_OBJECT", field, "El nodo inline debe ser un objeto.", blockId);
    return { text: "", inlineNodeCount: 0 };
  }
  rejectUnknownFields(value, ["type", "text", "marks"], field, errors, blockId);
  if (value.type !== "TEXT") {
    error(errors, "UNKNOWN_ENUM_VALUE", `${field}.type`, "Se esperaba un nodo TEXT.", blockId);
  }
  const text = validateString(value.text, `${field}.text`, STORY_LIMITS.inlineText, errors, { blockId });
  validateMarks(value.marks, `${field}.marks`, errors, blockId);
  return { text: text ?? "", inlineNodeCount: 1 };
}

function validateInlineNode(
  value: unknown,
  field: string,
  errors: StoryValidationError[],
  blockId: string,
) {
  if (!isRecord(value)) {
    error(errors, "EXPECTED_OBJECT", field, "El nodo inline debe ser un objeto.", blockId);
    return { text: "", inlineNodeCount: 0 };
  }

  if (value.type === "TEXT") return validateTextNode(value, field, errors, blockId);
  if (value.type !== "LINK") {
    error(errors, "UNKNOWN_ENUM_VALUE", `${field}.type`, "El tipo de nodo inline no está permitido.", blockId);
    return { text: "", inlineNodeCount: 0 };
  }

  rejectUnknownFields(value, ["type", "href", "children"], field, errors, blockId);
  const href = validateString(value.href, `${field}.href`, STORY_LIMITS.href, errors, { required: true, blockId });
  if (href !== null && !isSafeStoryLink(href)) {
    error(errors, "UNSAFE_LINK", `${field}.href`, "El enlace no usa una ruta o protocolo seguro.", blockId);
  }
  if (!Array.isArray(value.children)) {
    error(errors, "EXPECTED_ARRAY", `${field}.children`, "Los enlaces deben contener nodos TEXT.", blockId);
    return { text: "", inlineNodeCount: 1 };
  }
  if (value.children.length === 0) {
    error(errors, "REQUIRED_VALUE", `${field}.children`, "El enlace no puede estar vacío.", blockId);
  }
  if (value.children.length > STORY_LIMITS.inlineNodes) {
    error(errors, "LIMIT_EXCEEDED", `${field}.children`, "El enlace contiene demasiados nodos.", blockId);
  }
  const children = value.children.map((child, index) => (
    validateTextNode(child, `${field}.children[${index}]`, errors, blockId)
  ));
  const text = children.map((child) => child.text).join("");
  if (!text.trim()) {
    error(errors, "REQUIRED_VALUE", `${field}.children`, "El texto del enlace no puede estar vacío.", blockId);
  }
  return {
    text,
    inlineNodeCount: 1 + children.reduce((total, child) => total + child.inlineNodeCount, 0),
  };
}

function validateMediaIds(
  value: unknown,
  field: string,
  errors: StoryValidationError[],
  blockId: string,
) {
  if (!Array.isArray(value)) {
    error(errors, "EXPECTED_ARRAY", field, "Se esperaba una lista de media IDs.", blockId);
    return [];
  }
  const seen = new Set<string>();
  value.forEach((mediaId, index) => {
    const id = validateString(mediaId, `${field}[${index}]`, STORY_LIMITS.id, errors, { required: true, blockId });
    if (id && seen.has(id)) {
      error(errors, "DUPLICATE_VALUE", `${field}[${index}]`, "El media ID está duplicado.", blockId);
    }
    if (id) seen.add(id);
  });
  return value;
}

function validateBlock(
  value: unknown,
  index: number,
  errors: StoryValidationError[],
): StoryBodyMetrics {
  const field = `contentBlocks[${index}]`;
  if (!isRecord(value)) {
    error(errors, "EXPECTED_OBJECT", field, "El bloque debe ser un objeto.");
    return EMPTY_BODY_METRICS;
  }

  const blockId = typeof value.id === "string" ? value.id : "";
  validateString(value.id, `${field}.id`, STORY_LIMITS.blockId, errors, { required: true, blockId });
  if (!isStoryBlockType(value.type)) {
    error(errors, "UNKNOWN_ENUM_VALUE", `${field}.type`, "El tipo de bloque no está permitido.", blockId);
    return EMPTY_BODY_METRICS;
  }

  switch (value.type) {
    case "PARAGRAPH": {
      rejectUnknownFields(value, ["id", "type", "content"], field, errors, blockId);
      if (!Array.isArray(value.content)) {
        error(errors, "EXPECTED_ARRAY", `${field}.content`, "El párrafo debe contener nodos inline.", blockId);
        return EMPTY_BODY_METRICS;
      }
      if (value.content.length > STORY_LIMITS.inlineNodes) {
        error(errors, "LIMIT_EXCEEDED", `${field}.content`, "El párrafo contiene demasiados nodos.", blockId);
      }
      const inlineNodes = value.content.map((node, nodeIndex) => (
        validateInlineNode(node, `${field}.content[${nodeIndex}]`, errors, blockId)
      ));
      const text = inlineNodes.map((node) => node.text).join("");
      if (!text.trim()) {
        error(errors, "EMPTY_PARAGRAPH", `${field}.content`, "El párrafo no puede estar vacío.", blockId);
      }
      if (text.length > STORY_LIMITS.paragraphText) {
        error(
          errors,
          "LIMIT_EXCEEDED",
          `${field}.content`,
          `El texto agregado del párrafo supera ${STORY_LIMITS.paragraphText} caracteres.`,
          blockId,
        );
      }
      return {
        textLength: text.length,
        inlineNodeCount: inlineNodes.reduce((total, node) => total + node.inlineNodeCount, 0),
      };
    }
    case "HEADING": {
      rejectUnknownFields(value, ["id", "type", "level", "text"], field, errors, blockId);
      if (value.level !== 2 && value.level !== 3) {
        error(errors, "INVALID_HEADING_LEVEL", `${field}.level`, "Sólo se permiten encabezados H2 y H3.", blockId);
      }
      const text = validateString(value.text, `${field}.text`, STORY_LIMITS.heading, errors, {
        required: true,
        blockId,
      });
      return { textLength: text?.length ?? 0, inlineNodeCount: 0 };
    }
    case "IMAGE":
      rejectUnknownFields(value, ["id", "type", "mediaId"], field, errors, blockId);
      validateString(value.mediaId, `${field}.mediaId`, STORY_LIMITS.id, errors, { required: true, blockId });
      return EMPTY_BODY_METRICS;
    case "IMAGE_PAIR": {
      rejectUnknownFields(value, ["id", "type", "mediaIds"], field, errors, blockId);
      const mediaIds = validateMediaIds(value.mediaIds, `${field}.mediaIds`, errors, blockId);
      if (mediaIds.length !== 2 || new Set(mediaIds).size !== 2) {
        error(errors, "INVALID_IMAGE_PAIR", `${field}.mediaIds`, "IMAGE_PAIR exige exactamente dos IDs distintos.", blockId);
      }
      return EMPTY_BODY_METRICS;
    }
    case "GALLERY": {
      rejectUnknownFields(value, ["id", "type", "mediaIds"], field, errors, blockId);
      const mediaIds = validateMediaIds(value.mediaIds, `${field}.mediaIds`, errors, blockId);
      if (mediaIds.length < STORY_LIMITS.galleryMin || mediaIds.length > STORY_LIMITS.galleryMax) {
        error(
          errors,
          "INVALID_GALLERY_SIZE",
          `${field}.mediaIds`,
          `GALLERY exige entre ${STORY_LIMITS.galleryMin} y ${STORY_LIMITS.galleryMax} imágenes.`,
          blockId,
        );
      }
      return EMPTY_BODY_METRICS;
    }
    case "PULL_QUOTE": {
      rejectUnknownFields(value, ["id", "type", "text", "attribution"], field, errors, blockId);
      const text = validateString(value.text, `${field}.text`, STORY_LIMITS.quote, errors, {
        required: true,
        blockId,
      });
      let attribution: string | null = null;
      if (value.attribution !== undefined) {
        attribution = validateString(
          value.attribution,
          `${field}.attribution`,
          STORY_LIMITS.quoteAttribution,
          errors,
          { blockId },
        );
      }
      return {
        textLength: (text?.length ?? 0) + (attribution?.length ?? 0),
        inlineNodeCount: 0,
      };
    }
    case "EVENT_REFERENCE":
      rejectUnknownFields(value, ["id", "type", "eventId"], field, errors, blockId);
      validateString(value.eventId, `${field}.eventId`, STORY_LIMITS.id, errors, { required: true, blockId });
      return EMPTY_BODY_METRICS;
  }

  return EMPTY_BODY_METRICS;
}

function validateContentFields(
  schemaVersion: unknown,
  contentBlocks: unknown,
  errors: StoryValidationError[],
) {
  if (schemaVersion !== STORY_SCHEMA_VERSION) {
    error(errors, "UNSUPPORTED_SCHEMA_VERSION", "schemaVersion", "La versión del documento no está soportada.");
  }
  if (!Array.isArray(contentBlocks)) {
    error(errors, "EXPECTED_ARRAY", "contentBlocks", "El contenido debe ser una lista de bloques.");
    return;
  }
  if (contentBlocks.length > STORY_LIMITS.blocks) {
    error(errors, "LIMIT_EXCEEDED", "contentBlocks", `No se permiten más de ${STORY_LIMITS.blocks} bloques.`);
  }
  const seen = new Set<string>();
  let storyBodyTextLength = 0;
  let totalInlineNodeCount = 0;
  contentBlocks.forEach((block, index) => {
    const metrics = validateBlock(block, index, errors);
    storyBodyTextLength += metrics.textLength;
    totalInlineNodeCount += metrics.inlineNodeCount;
    if (isRecord(block) && typeof block.id === "string" && block.id.trim()) {
      if (seen.has(block.id)) {
        error(errors, "DUPLICATE_BLOCK_ID", `contentBlocks[${index}].id`, "El ID de bloque está duplicado.", block.id);
      }
      seen.add(block.id);
    }
  });
  if (storyBodyTextLength > STORY_LIMITS.storyBodyText) {
    error(
      errors,
      "LIMIT_EXCEEDED",
      "contentBlocks",
      `El texto agregado del body supera ${STORY_LIMITS.storyBodyText} caracteres.`,
    );
  }
  if (totalInlineNodeCount > STORY_LIMITS.totalInlineNodes) {
    error(
      errors,
      "LIMIT_EXCEEDED",
      "contentBlocks",
      `El body supera ${STORY_LIMITS.totalInlineNodes} nodos inline estructurales.`,
    );
  }
}

export function validateStoryDocument(input: unknown): StoryValidationResult<StoryDocument> {
  const errors: StoryValidationError[] = [];
  if (!isRecord(input)) {
    return {
      ok: false,
      errors: [{ code: "EXPECTED_OBJECT", field: "storyDocument", message: "El documento debe ser un objeto." }],
    };
  }
  rejectUnknownFields(input, ["schemaVersion", "contentBlocks"], "storyDocument", errors);
  validateContentFields(input.schemaVersion, input.contentBlocks, errors);
  const finalErrors = uniqueErrors(errors);
  return finalErrors.length
    ? { ok: false, errors: finalErrors }
    : { ok: true, value: input as StoryDocument, errors: [] };
}

function validateTaxonomyList(
  value: unknown,
  field: string,
  errors: StoryValidationError[],
) {
  if (!Array.isArray(value)) {
    error(errors, "EXPECTED_ARRAY", field, "Se esperaba una lista.");
    return;
  }
  if (value.length > STORY_LIMITS.taxonomyValues) {
    error(errors, "LIMIT_EXCEEDED", field, "La lista de taxonomía es demasiado grande.");
  }
  const seen = new Set<string>();
  value.forEach((item, index) => {
    const text = validateString(item, `${field}[${index}]`, STORY_LIMITS.taxonomyValue, errors, { required: true });
    if (text && seen.has(text)) {
      error(errors, "DUPLICATE_VALUE", `${field}[${index}]`, "El valor de taxonomía está duplicado.");
    }
    if (text) seen.add(text);
  });
}

const STORY_FIELDS = [
  "id",
  "slug",
  "status",
  "type",
  "collection",
  "title",
  "dek",
  "contextLocation",
  "contentBlocks",
  "heroMediaId",
  "seoTitle",
  "seoDescription",
  "disciplineSlugs",
  "territoryIds",
  "publishedAt",
  "updatedAt",
  "homeRank",
  "schemaVersion",
] as const;

export function validateStoryRecord(input: unknown): StoryValidationResult<StoryRecord> {
  const errors: StoryValidationError[] = [];
  if (!isRecord(input)) {
    return {
      ok: false,
      errors: [{ code: "EXPECTED_OBJECT", field: "story", message: "La Historia debe ser un objeto." }],
    };
  }

  rejectUnknownFields(input, STORY_FIELDS, "story", errors);
  validateString(input.id, "id", STORY_LIMITS.id, errors, { required: true });
  const slug = validateString(input.slug, "slug", STORY_LIMITS.slug, errors);
  if (slug && !isValidStorySlug(slug)) {
    error(errors, "SLUG_INVALID", "slug", "El slug sólo puede contener minúsculas, números y guiones simples.");
  }
  validateEnum(input.status, STORY_STATUSES, "status", errors);
  validateEnum(input.type, STORY_TYPES, "type", errors);
  validateEnum(input.collection, STORY_COLLECTIONS, "collection", errors);
  validateString(input.title, "title", STORY_LIMITS.title, errors);
  validateString(input.dek, "dek", STORY_LIMITS.dek, errors);
  if (input.contextLocation !== undefined && input.contextLocation !== null) {
    validateString(input.contextLocation, "contextLocation", STORY_LIMITS.contextLocation, errors);
  }
  validateString(input.heroMediaId, "heroMediaId", STORY_LIMITS.id, errors);
  validateString(input.seoTitle, "seoTitle", STORY_LIMITS.seoTitle, errors);
  validateString(input.seoDescription, "seoDescription", STORY_LIMITS.seoDescription, errors);
  validateTaxonomyList(input.disciplineSlugs, "disciplineSlugs", errors);
  validateTaxonomyList(input.territoryIds, "territoryIds", errors);
  validateContentFields(input.schemaVersion, input.contentBlocks, errors);

  if (typeof input.updatedAt !== "string" || !input.updatedAt || Number.isNaN(Date.parse(input.updatedAt))) {
    error(errors, "INVALID_DATE", "updatedAt", "updatedAt debe ser una fecha válida.");
  }
  if (
    input.publishedAt !== undefined &&
    input.publishedAt !== null &&
    (typeof input.publishedAt !== "string" || Number.isNaN(Date.parse(input.publishedAt)))
  ) {
    error(errors, "INVALID_DATE", "publishedAt", "publishedAt debe ser una fecha válida o null.");
  }
  if (
    input.homeRank !== undefined &&
    input.homeRank !== null &&
    (typeof input.homeRank !== "number" ||
      !Number.isInteger(input.homeRank) ||
      input.homeRank < 1 ||
      input.homeRank > 3)
  ) {
    error(errors, "INVALID_HOME_RANK", "homeRank", "homeRank debe estar entre 1 y 3.");
  }

  const finalErrors = uniqueErrors(errors);
  return finalErrors.length
    ? { ok: false, errors: finalErrors }
    : { ok: true, value: input as StoryRecord, errors: [] };
}

export function validateStoryCredits(input: unknown): StoryValidationResult<readonly StoryCredit[]> {
  const errors: StoryValidationError[] = [];
  if (!Array.isArray(input)) {
    return { ok: false, errors: [{ code: "EXPECTED_ARRAY", field: "credits", message: "Los créditos deben ser una lista." }] };
  }
  if (input.length > STORY_LIMITS.credits) {
    error(errors, "LIMIT_EXCEEDED", "credits", "Hay demasiados créditos.");
  }
  const seen = new Set<string>();
  input.forEach((item, index) => {
    const field = `credits[${index}]`;
    if (!isRecord(item)) {
      error(errors, "EXPECTED_OBJECT", field, "El crédito debe ser un objeto.");
      return;
    }
    rejectUnknownFields(item, ["personId", "role", "sortOrder"], field, errors);
    const personId = validateString(item.personId, `${field}.personId`, STORY_LIMITS.id, errors, { required: true });
    const role = validateEnum(item.role, STORY_CREDIT_ROLES, `${field}.role`, errors);
    validateNonNegativeInteger(item.sortOrder, `${field}.sortOrder`, errors);
    if (personId && role) {
      const key = `${personId}\u0000${role}`;
      if (seen.has(key)) error(errors, "DUPLICATE_VALUE", field, "El crédito está duplicado.");
      seen.add(key);
    }
  });
  const finalErrors = uniqueErrors(errors);
  return finalErrors.length
    ? { ok: false, errors: finalErrors }
    : { ok: true, value: input as readonly StoryCredit[], errors: [] };
}

export function validateStoryEventRelations(
  input: unknown,
): StoryValidationResult<readonly StoryEventRelation[]> {
  const errors: StoryValidationError[] = [];
  if (!Array.isArray(input)) {
    return {
      ok: false,
      errors: [{ code: "EXPECTED_ARRAY", field: "eventRelations", message: "Las relaciones deben ser una lista." }],
    };
  }
  if (input.length > STORY_LIMITS.eventRelations) {
    error(errors, "LIMIT_EXCEEDED", "eventRelations", "Hay demasiadas relaciones con eventos.");
  }
  const seen = new Set<string>();
  input.forEach((item, index) => {
    const field = `eventRelations[${index}]`;
    if (!isRecord(item)) {
      error(errors, "EXPECTED_OBJECT", field, "La relación debe ser un objeto.");
      return;
    }
    rejectUnknownFields(item, ["eventId", "relationType", "sortOrder"], field, errors);
    const eventId = validateString(item.eventId, `${field}.eventId`, STORY_LIMITS.id, errors, { required: true });
    validateEnum(item.relationType, STORY_EVENT_RELATION_TYPES, `${field}.relationType`, errors);
    validateNonNegativeInteger(item.sortOrder, `${field}.sortOrder`, errors);
    if (eventId && seen.has(eventId)) {
      error(errors, "DUPLICATE_VALUE", field, "El evento ya está relacionado con la Historia.");
    }
    if (eventId) seen.add(eventId);
  });
  const finalErrors = uniqueErrors(errors);
  return finalErrors.length
    ? { ok: false, errors: finalErrors }
    : { ok: true, value: input as readonly StoryEventRelation[], errors: [] };
}

function validatePublicationContext(input: unknown): StoryValidationResult<StoryPublicationContext> {
  const errors: StoryValidationError[] = [];
  if (!isRecord(input)) {
    return {
      ok: false,
      errors: [{ code: "MEDIA_CONTEXT_INVALID", field: "context", message: "El contexto de publicación debe ser un objeto." }],
    };
  }
  rejectUnknownFields(input, ["media"], "context", errors);
  if (!Array.isArray(input.media)) {
    error(errors, "MEDIA_CONTEXT_INVALID", "context.media", "La media de validación debe ser una lista.");
  } else {
    const seen = new Set<string>();
    input.media.forEach((item, index) => {
      const field = `context.media[${index}]`;
      if (!isRecord(item)) {
        error(errors, "MEDIA_CONTEXT_INVALID", field, "El registro de media debe ser un objeto.");
        return;
      }
      rejectUnknownFields(item, ["id", "altText", "rightsType"], field, errors);
      const id = typeof item.id === "string" && item.id.trim() ? item.id : null;
      if (!id || id.length > STORY_LIMITS.id) {
        error(errors, "MEDIA_CONTEXT_INVALID", `${field}.id`, "El media ID no es válido.");
      } else if (seen.has(id)) {
        error(errors, "MEDIA_CONTEXT_INVALID", `${field}.id`, "El media ID está duplicado.");
      } else {
        seen.add(id);
      }
      if (typeof item.altText !== "string") {
        error(errors, "MEDIA_CONTEXT_INVALID", `${field}.altText`, "El alt debe ser texto.");
      }
      if (!isStoryRightsType(item.rightsType)) {
        error(errors, "MEDIA_CONTEXT_INVALID", `${field}.rightsType`, "El tipo de derechos no es válido.");
      }
    });
  }
  const finalErrors = uniqueErrors(errors);
  return finalErrors.length
    ? { ok: false, errors: finalErrors }
    : { ok: true, value: input as StoryPublicationContext, errors: [] };
}

export function collectStoryMediaIds(blocks: readonly StoryContentBlock[]) {
  const ids: string[] = [];
  for (const block of blocks) {
    if (block.type === "IMAGE") ids.push(block.mediaId);
    if (block.type === "IMAGE_PAIR" || block.type === "GALLERY") ids.push(...block.mediaIds);
  }
  return [...new Set(ids)];
}

function validateMediaForPublication(
  mediaId: string,
  mediaById: ReadonlyMap<string, StoryMediaValidationRecord>,
  errors: StoryValidationError[],
  role: "hero" | "block",
) {
  const media = mediaById.get(mediaId);
  if (!media) {
    error(
      errors,
      role === "hero" ? "HERO_MEDIA_NOT_FOUND" : "MEDIA_NOT_FOUND",
      role === "hero" ? "heroMediaId" : `media.${mediaId}`,
      "La media referenciada no existe en el contexto de publicación.",
    );
    return;
  }
  if (!media.altText.trim()) {
    error(
      errors,
      role === "hero" ? "HERO_ALT_REQUIRED" : "MEDIA_ALT_REQUIRED",
      `media.${mediaId}.altText`,
      "La media necesita texto alternativo.",
    );
  }
  if (media.rightsType === "UNKNOWN") {
    error(
      errors,
      role === "hero" ? "HERO_RIGHTS_UNKNOWN" : "MEDIA_RIGHTS_UNKNOWN",
      `media.${mediaId}.rightsType`,
      "Los derechos UNKNOWN impiden publicar.",
    );
  }
}

export function validateStoryPublication(
  input: unknown,
  context: unknown,
): StoryPublicationGateResult {
  const errors: StoryValidationError[] = [];
  const storyResult = validateStoryRecord(input);
  const contextResult = validatePublicationContext(context);

  if (!storyResult.ok) errors.push(...storyResult.errors);
  if (!contextResult.ok) errors.push(...contextResult.errors);
  if (!storyResult.ok) return { ok: false, errors: uniqueErrors(errors) };

  const story = storyResult.value;
  if (story.status !== "READY") {
    error(errors, "STATUS_NOT_READY", "status", "Sólo una Historia READY puede superar el gate de publicación.");
  }
  if (!story.title.trim()) error(errors, "TITLE_REQUIRED", "title", "El título es obligatorio.");
  if (!story.slug.trim()) {
    error(errors, "SLUG_REQUIRED", "slug", "El slug es obligatorio.");
  } else if (!isValidStorySlug(story.slug)) {
    error(errors, "SLUG_INVALID", "slug", "El slug no cumple el formato público.");
  }
  if (!story.dek.trim()) error(errors, "DEK_REQUIRED", "dek", "La entradilla es obligatoria.");
  if (!story.heroMediaId.trim()) error(errors, "HERO_REQUIRED", "heroMediaId", "El hero es obligatorio.");
  if (story.contentBlocks.length === 0) {
    error(errors, "CONTENT_REQUIRED", "contentBlocks", "La Historia necesita contenido.");
  }
  if (!story.seoTitle.trim()) error(errors, "SEO_TITLE_REQUIRED", "seoTitle", "El título SEO es obligatorio.");
  if (!story.seoDescription.trim()) {
    error(errors, "SEO_DESCRIPTION_REQUIRED", "seoDescription", "La descripción SEO es obligatoria.");
  }

  if (contextResult.ok) {
    const mediaById = new Map(contextResult.value.media.map((media) => [media.id, media]));
    if (story.heroMediaId.trim()) {
      validateMediaForPublication(story.heroMediaId, mediaById, errors, "hero");
    }
    for (const mediaId of collectStoryMediaIds(story.contentBlocks)) {
      validateMediaForPublication(mediaId, mediaById, errors, "block");
    }
  }

  const finalErrors = uniqueErrors(errors);
  return { ok: finalErrors.length === 0, errors: finalErrors };
}
