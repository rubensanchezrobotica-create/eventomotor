/** Private administrative evidence. Never spread this object into a public DTO. */
export type StoryCommercialMetadata = {
  advertiserName: string;
  advertiserConfirmed: boolean;
  factsVerified: boolean;
  editorialApprovalRef: string;
  imageAuthorizationRef: string;
  commercialLinksChecked: boolean;
  disclosureLabel: "Contenido patrocinado";
  approvedContentHash: string | null;
};

export const COMMERCIAL_DISCLOSURE = "Contenido patrocinado" as const;
export type CommercialHashSource = Pick<import("@/lib/supabase").StoryRow, "id" | "slug" | "type" | "collection" | "title" | "dek" | "context_location"
  | "content_blocks" | "schema_version" | "hero_media_id" | "seo_title" | "seo_description" | "discipline_slugs" | "territory_ids" | "commercial_metadata">;

export function commercialApprovalPayload(story: CommercialHashSource): unknown[] {
  const m = story.commercial_metadata;
  const evidence = isCommercialMetadata(m) ? {
    advertiserName: m.advertiserName, advertiserConfirmed: m.advertiserConfirmed, factsVerified: m.factsVerified,
    editorialApprovalRef: m.editorialApprovalRef, imageAuthorizationRef: m.imageAuthorizationRef,
    commercialLinksChecked: m.commercialLinksChecked, disclosureLabel: m.disclosureLabel,
  } : null;
  return [story.id, story.slug, story.type, story.collection, story.title, story.dek, story.context_location,
    story.content_blocks, story.schema_version, story.hero_media_id, story.seo_title, story.seo_description,
    story.discipline_slugs, story.territory_ids, evidence];
}
export const COMMERCIAL_BLOCKER_MESSAGES: Readonly<Record<string, string>> = {
  advertiserName: "Falta confirmar la identidad del anunciante.", factsVerified: "Quedan datos factuales pendientes de verificación.",
  editorialApprovalRef: "Falta la referencia de aprobación editorial.", imageAuthorizationRef: "Falta la evidencia de autorización de imagen.",
  commercialLinksChecked: "Falta comprobar los enlaces comerciales.", approvedContentHash: "La aprobación no corresponde a la versión que intentas guardar.",
  contentBlocks: "Falta un enlace comercial identificado como sponsored.", commercialMetadata: "Faltan metadatos comerciales válidos.",
};
export function emptyCommercialMetadata(): StoryCommercialMetadata {
  return { advertiserName: "", advertiserConfirmed: false, factsVerified: false,
    editorialApprovalRef: "", imageAuthorizationRef: "", commercialLinksChecked: false,
    disclosureLabel: COMMERCIAL_DISCLOSURE, approvedContentHash: null };
}

export function isCommercialMetadata(value: unknown): value is StoryCommercialMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const keys = Object.keys(emptyCommercialMetadata());
  return Object.keys(v).length === keys.length && Object.keys(v).every((key) => keys.includes(key))
    && ["advertiserName", "editorialApprovalRef", "imageAuthorizationRef"].every((key) =>
      typeof v[key] === "string" && (v[key] as string).length <= 1000)
    && ["advertiserConfirmed", "factsVerified", "commercialLinksChecked"].every((key) => typeof v[key] === "boolean")
    && v.disclosureLabel === COMMERCIAL_DISCLOSURE
    && (v.approvedContentHash === null || (typeof v.approvedContentHash === "string" && /^[a-f0-9]{64}$/.test(v.approvedContentHash)));
}

export function commercialGateIssues(value: unknown): Array<{ field: string; message: string }> {
  if (!isCommercialMetadata(value)) return [{ field: "commercialMetadata", message: "Faltan metadatos comerciales válidos." }];
  const issues: Array<{ field: string; message: string }> = [];
  const require = (condition: boolean, field: string, message: string) => { if (!condition) issues.push({ field, message }); };
  require(Boolean(value.advertiserName.trim()) && value.advertiserConfirmed, "advertiserName", "Falta confirmar la identidad del anunciante.");
  require(value.factsVerified, "factsVerified", "Quedan datos factuales pendientes de verificación.");
  require(Boolean(value.editorialApprovalRef.trim()), "editorialApprovalRef", "Falta la referencia de aprobación editorial.");
  require(Boolean(value.imageAuthorizationRef.trim()), "imageAuthorizationRef", "Falta la evidencia de autorización de imagen.");
  require(value.commercialLinksChecked, "commercialLinksChecked", "Falta comprobar los enlaces comerciales.");
  return issues;
}

/** JSON canonicalization shared with the SQL function: ASCII contract keys, no whitespace. */
export function canonicalCommercialJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalCommercialJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalCommercialJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
