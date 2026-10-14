# A16E/F — Public Stories delivery and first controlled launch

Baseline: `506feba97d0343066ecf9b206fdac2df1ac9e2f0` (A16D already operational).

## Public boundary

- `/historias` and `/historias/[slug]` use server-only PUBLISHED queries, request-only memoization and dynamic SSR. No draft/admin loader is used publicly.
- A second state/version read fences archival races. The explicit public DTO drops rights notes, raw rows and private locators. Media must belong to the Story, be in `story-media`, have canonical immutable paths, known rights, ALT and approved dimensions.
- The exact existing StoryArticle/StoryRenderer/CSS are reused. The shared interior shell only adds an opt-in `hideHero` to avoid a second header/H1. Other callers retain the previous default.
- Event modules consume only published summaries, retain the event's data/SEO, and render nothing if the optional editorial lookup is unavailable. Home and navigation remain unchanged.
- Metadata uses CMS title/description, canonical, stable public hero, Article author/publisher and publication timestamps. JSON-LD escapes `<`. Sitemap receives only validated public Stories.

## Protected launch

1. Validate branch CI, A16D regressions and the exact Preview build. Confirm origin/main has not drifted, integrate normally, and verify Production/Current and www assignment before content operations.
2. Authenticate normally through the existing admin login. All launch actions independently require the existing session and same-origin guard. No exported cookies, forged tokens, public ingestion API or raw publication RPC bypass.
3. Re-read the one approved Story; capture its version and semantic fingerprint, media metadata, credits, relations and original byte fingerprints. Abort on any unexpected editorial change.
4. Submit `/admin/historias/[id]/publicacion` preparation with its actual generated Server Action fields, expected version and explicit derivative consent.
5. Preparation runs the complete pure editorial gate before promotion, invokes the existing media service for each referenced image, preserves originals, uses upsert:false and verifies existing public bytes on retries. Re-read after each promotion; stop on editorial drift and retain verified progress.
6. The existing versioned draft service moves DRAFT to READY without altering approved fields. Real byte decoding, bucket/catalog ownership and anonymous delivery are checked. READY remains private.
7. Re-read the READY version and submit its explicit publication form. The existing publishStory service runs full editorial/technical readiness; A16D publish_story atomically checks the version, shared lock and idempotency receipt. No direct update to PUBLISHED is introduced.
8. Revalidate article, index, sitemap and related event. Re-read on any ambiguous response before retrying; never blindly repeat promotions or use another publication identity after a possible success.
9. Verify HTTP 200 without credentials, all expected blocks/photos, desktop/mobile layout, links, SEO and sitemap. Only then report PUBLISHED_VERIFIED.

No new SQL, editorial grants, original-photo uploads, newsletter sends, Home module or main-menu launch.

## Validation

The new integration test runs ONLY on loopback Supabase under Stories CI. It exercises actual private upload/finalization, multi-role credits, event RPC, derivative promotion, READY, publication receipt/idempotency, original-byte preservation, public loaders and sitemap. Existing pgTAP, two-connection concurrency and media/admin/publication suites remain enabled.

Local preflight: service tests 90/90; route/action tests 4/4 including existing credits action; admin/upload validation 53/53; protected media API 8/8; broader renderer/agenda/navigation regressions 295/297. The two Supercross expectations also fail identically at the unchanged baseline and are not modified here. TypeScript, focused ESLint and diff check pass.

The clean local build compiles but cannot prerender existing opportunity pages without Supabase configuration. No secrets/configuration are copied to compensate. The configured exact-SHA Vercel Preview build is the mandatory build gate.
