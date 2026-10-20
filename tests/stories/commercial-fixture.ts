import type { PublicStorySource } from "@/lib/stories/story-public.server";
import { emptyCommercialMetadata } from "@/lib/stories/story-commercial";

/** Synthetic test content only: no agency draft, advertiser or real media. */
export function commercialFixture(): PublicStorySource {
  const id = "c1000000-0000-4000-8000-000000000001", mediaId = "c2000000-0000-4000-8000-000000000001", personId = "c3000000-0000-4000-8000-000000000001";
  return {
    story: { id, slug: "synthetic-sponsored-article", type: "ARTICULO", collection: "COLABORACIONES", status: "DRAFT",
      title: "Synthetic sponsored article", dek: "Synthetic summary", context_location: null,
      content_blocks: [{ id: "paragraph", type: "PARAGRAPH", content: [
        { type: "TEXT", text: "Consulta " },
        { type: "LINK", href: "https://www.kawasaki.es/es_es/Motorcycles/Adventure.html", sponsored: true, children: [{ type: "TEXT", text: "motos trail" }] },
        { type: "TEXT", text: " y nuestra " },
        { type: "LINK", href: "https://www.eventomotor.com/disciplinas/rutas", children: [{ type: "TEXT", text: "agenda de rutas moteras" }] },
      ] }], schema_version: 1, hero_media_id: mediaId, seo_title: "Synthetic SEO", seo_description: "Synthetic description",
      discipline_slugs: ["rutas"], territory_ids: [], home_rank: null, published_at: null,
      created_at: "2030-01-01T00:00:00Z", updated_at: "2030-01-01T00:00:00Z",
      commercial_metadata: emptyCommercialMetadata() },
    media: [{ id: mediaId, story_id: id, bucket_id: "story-media", object_path: `${id}/${mediaId}/asset.webp`,
      width: 1200, height: 800, mime_type: "image/webp", byte_size: 1000, alt_text: "Synthetic licensed photograph", caption: null, credit: null,
      rights_type: "LICENSED", rights_notes: "PRIVATE_RIGHTS_EVIDENCE", created_at: "2030-01-01T00:00:00Z", updated_at: "2030-01-01T00:00:00Z" }],
    people: [{ id: personId, display_name: "Synthetic agency author" }],
    credits: [{ story_id: id, person_id: personId, role: "TEXT", sort_order: 0 }], relations: [], events: [],
  };
}
