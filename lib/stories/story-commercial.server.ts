import "server-only";
import { createHash } from "node:crypto";
import { canonicalCommercialJson, commercialApprovalPayload, commercialGateIssues, isCommercialMetadata, type CommercialHashSource } from "./story-commercial";

export function commercialContentHash(story: CommercialHashSource): string {
  return createHash("sha256").update(canonicalCommercialJson(commercialApprovalPayload(story))).digest("hex");
}

export function storyCommercialGate(story: CommercialHashSource) {
  if (story.collection !== "COLABORACIONES") return [];
  const issues = commercialGateIssues(story.commercial_metadata);
  if (!isCommercialMetadata(story.commercial_metadata)
    || story.commercial_metadata.approvedContentHash !== commercialContentHash(story)) {
    issues.push({ field: "approvedContentHash", message: "La aprobación no corresponde a la versión vigente. Revisa y confirma esta versión." });
  }
  const hasSponsoredLink = Array.isArray(story.content_blocks) && story.content_blocks.some((b) => b?.type === "PARAGRAPH"
    && Array.isArray(b.content) && b.content.some((node) => node?.type === "LINK" && node.sponsored === true));
  if (!hasSponsoredLink) issues.push({ field: "contentBlocks", message: "Falta un enlace comercial identificado como sponsored." });
  return issues;
}
