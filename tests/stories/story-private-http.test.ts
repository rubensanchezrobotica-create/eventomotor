import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ADMIN_SESSION_COOKIE, ADMIN_MEDIA_SESSION_COOKIE, ADMIN_SESSION_TTL_SECONDS, createAdminSessionToken } from "@/lib/admin-session";

// Actual Next HTTP/Flight render against an isolated loopback-only data adapter.
// All records, credentials and tokens below are synthetic. No production config
// is read, no real signed URL/response is printed, and no editorial write occurs.
test("actual Next HTML, Flight, prefetch and auxiliary routes contain no private data without a valid session", { timeout: 240_000 }, async (t) => {
  const secret = "synthetic-next-http-security-only", key = "synthetic-loopback-service-key";
  const person = { id: "d3000000-0000-4000-8000-000000000001", display_name: "SYNTHETIC_PRIVATE_PERSON", active: true };
  const stories = (["DRAFT", "READY", "ARCHIVED"] as const).map((status, index) => ({
    id: `d1000000-0000-4000-8000-00000000000${index + 1}`, status, type: "CRONICA", collection: "DESDE_DENTRO", slug: `synthetic-private-${index}`,
    title: `SYNTHETIC_PRIVATE_TITLE_${index}`, dek: "SYNTHETIC_PRIVATE_DEK", context_location: "SYNTHETIC_PRIVATE_PLACE",
    schema_version: 1, hero_media_id: `d2000000-0000-4000-8000-00000000000${index + 1}`,
    content_blocks: [{ id: "private-p", type: "PARAGRAPH", content: [{ type: "TEXT", text: "SYNTHETIC_PRIVATE_BODY" }] }],
    seo_title: "SYNTHETIC_PRIVATE_SEO", seo_description: "SYNTHETIC_PRIVATE_DESCRIPTION", discipline_slugs: ["circuito"], territory_ids: ["cataluna"],
    updated_at: "2030-01-01T00:00:00Z", created_at: "2030-01-01T00:00:00Z", published_at: null, home_rank: null,
  }));
  const media = stories.map((s) => ({ id: s.hero_media_id, story_id: s.id, bucket_id: "story-media-drafts", object_path: `${s.id}/${s.hero_media_id}/asset.png`,
    width: 1200, height: 800, mime_type: "image/png", byte_size: 100, alt_text: "SYNTHETIC_PRIVATE_ALT", caption: "SYNTHETIC_PRIVATE_CAPTION", credit: person.display_name,
    rights_type: "OWN", rights_notes: "SYNTHETIC_PRIVATE_RIGHTS", created_at: s.created_at, updated_at: s.updated_at }));
  const credits = stories.map((s) => ({ story_id: s.id, person_id: person.id, role: "TEXT", sort_order: 0 }));
  // Mutable synthetic source: the same production server must observe publishing,
  // edits and archival without rebuilding or calling a cache invalidation action.
  const sitemapStory = { ...stories[0], id: "d1000000-0000-4000-8000-000000000004",
    title: "Synthetic published Home story", dek: "Synthetic editorial summary.",
    slug: "synthetic-sitemap-chronicle", status: "DRAFT", published_at: null as string | null,
    hero_media_id: "d2000000-0000-4000-8000-000000000004" };
  const sitemapMedia = { ...media[0], id: sitemapStory.hero_media_id, story_id: sitemapStory.id,
    alt_text: "Synthetic public hero",
    bucket_id: "story-media", mime_type: "image/webp",
    object_path: `${sitemapStory.id}/${sitemapStory.hero_media_id}/asset.webp` };
  const sitemapCredit = { ...credits[0], story_id: sitemapStory.id };
  // Existing strict public agenda intentionally rejects an entirely empty DB.
  // One public synthetic event supports prerendering without production access.
  const publicEvents = [{ id: "synthetic-http-fixture-event", slug: "synthetic-http-fixture-event", title: "Synthetic public event",
    championship: "Synthetic", discipline: "Circuito", start_date: "2030-01-02", end_date: "2030-01-03", venue: "Synthetic circuit",
    city: "Madrid", province: "Madrid", region: "Comunidad de Madrid", country: "España", visible: true, featured: false,
    tags: ["Circuito"], vehicle_type: "coche", source: "Synthetic fixture", source_url: "https://example.test", ticket_url: null,
    image_url: null, event_status: "confirmed", created_at: "2030-01-01T00:00:00Z", updated_at: "2030-01-01T00:00:00Z" }];
  let reads = 0, signings = 0;
  const fixture = createHttpServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    response.setHeader("content-type", "application/json");
    const send = (value: unknown) => response.end(JSON.stringify(value));
    if (url.pathname.startsWith("/rest/v1/")) {
      reads++;
      const table = url.pathname.split("/").at(-1);
      const records = table === "stories" ? [...stories, sitemapStory] : table === "story_media" ? [...media, sitemapMedia] : table === "editorial_people" ? [person] : table === "story_credits" ? [...credits, sitemapCredit] : table === "events" ? publicEvents : [];
      const rows = records.filter((row) => [...url.searchParams].every(([field, filter]) => !filter.startsWith("eq.") || String((row as Record<string, unknown>)[field]) === filter.slice(3)));
      return send(rows);
    }
    if (url.pathname === "/storage/v1/bucket/story-media-drafts") return send({ id: "story-media-drafts", public: false, file_size_limit: 26214400, allowed_mime_types: ["image/jpeg", "image/png", "image/webp"] });
    if (url.pathname.startsWith("/storage/v1/object/sign/story-media-drafts/")) {
      signings++; return send({ signedURL: url.pathname.slice("/storage/v1".length) + "?token=SYNTHETIC_TEST_ONLY" });
    }
    response.statusCode = 404; return send({ error: "Synthetic fixture path unsupported" });
  });
  fixture.listen(0, "127.0.0.1"); await once(fixture, "listening");
  t.after(async () => { fixture.closeAllConnections(); await new Promise<void>((resolve) => fixture.close(() => resolve())); });
  const fixturePort = (fixture.address() as { port: number }).port;
  const reservation = createNetServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
  const port = (reservation.address() as { port: number }).port; await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const origin = `http://127.0.0.1:${port}`;
  let serverMessages = "";
  const environment: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production", ADMIN_SECRET: secret,
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${fixturePort}`, SUPABASE_SERVICE_ROLE_KEY: key,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-loopback-anon", NEXT_TELEMETRY_DISABLED: "1" };
  const build = spawn(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
    cwd: process.cwd(), env: environment, stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => { if (build.exitCode === null) build.kill("SIGTERM"); });
  build.stdout.on("data", (chunk) => { serverMessages = (serverMessages + String(chunk)).slice(-16000); });
  build.stderr.on("data", (chunk) => { serverMessages = (serverMessages + String(chunk)).slice(-16000); });
  const [buildCode] = await once(build, "exit");
  if (buildCode !== 0) t.diagnostic(JSON.stringify({ fixtureBuild: "FAIL", hints: {
    font: /Failed to fetch.*font|next\/font.*error/.test(serverMessages), config: /not configured/.test(serverMessages),
    typecheck: /Type error|error TS/.test(serverMessages), prerender: /Error occurred prerendering/.test(serverMessages),
  }, errors: serverMessages.split(/\r?\n/).filter((line) => /^Error:|^TypeError:|^Error occurred prerendering/.test(line)).slice(0, 4)
    .map((line) => line.replace(/https?:\S+/g, "[URL]").replace(/SYNTHETIC_PRIVATE\S*/g, "[SYNTHETIC_MARKER]").slice(0, 240)) }));
  assert.equal(buildCode, 0, "production build with loopback synthetic data succeeds");
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: process.cwd(), env: environment, stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => { serverMessages = (serverMessages + String(chunk)).slice(-16000); });
  server.stderr.on("data", (chunk) => { serverMessages = (serverMessages + String(chunk)).slice(-16000); });
  t.after(() => { server.kill("SIGTERM"); });
  let online = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) break;
    try { const r = await fetch(`${origin}/admin/login`, { signal: AbortSignal.timeout(2000) }); await r.text(); if (r.status === 200) { online = true; break; } } catch { /* startup only */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(online, "isolated Next server starts");
  const valid = createAdminSessionToken(secret);
  const expired = createAdminSessionToken(secret, Date.now() - (ADMIN_SESSION_TTL_SECONDS + 60) * 1000);
  const sessions = [undefined, `${ADMIN_SESSION_COOKIE}=invalid; ${ADMIN_MEDIA_SESSION_COOKIE}=invalid`, `${ADMIN_SESSION_COOKIE}=${expired}; ${ADMIN_MEDIA_SESSION_COOKIE}=${expired}`, `${ADMIN_MEDIA_SESSION_COOKIE}=${valid}`];
  const variants: Record<string, string>[] = [{}, { RSC: "1" }, { RSC: "1", "Next-Router-Prefetch": "1" },
    { RSC: "1", "Next-Router-State-Tree": encodeURIComponent(JSON.stringify(["", { children: ["admin", {}] }])) },
    { RSC: "1", "Next-Router-State-Tree": encodeURIComponent(JSON.stringify(["", {}, null, "metadata-only"])) }];
  const noPrivate = (text: string) => !/SYNTHETIC_PRIVATE|story-media-drafts|\/object\/sign\/|rights_notes|token=/.test(text);
  let checked = 0;
  for (const s of stories) {
    const paths = [`/admin/historias/${s.id}/preview`, `/admin/historias/${s.id}`, `/admin/historias/${s.id}/publicacion`, `/admin/historias?status=${s.status}`, `/admin/historias/nueva`];
    for (const path of paths) for (const headers of variants) for (const cookie of sessions) {
      const beforeReads = reads, beforeSignings = signings;
      const r = await fetch(origin + path, { headers: { ...headers, ...(cookie ? { Cookie: cookie } : {}) }, redirect: "manual", signal: AbortSignal.timeout(30000) });
      const text = await r.text();
      assert.ok(noPrivate(text), "denied HTML/Flight response contains no private marker or signed locator");
      if (![200, 307].includes(r.status)) t.diagnostic(JSON.stringify({ status: r.status, path, mode: headers.RSC ? "Flight" : "HTML",
        hints: { font: /font|Failed to fetch/.test(serverMessages), missingConfig: /not configured/.test(serverMessages), routerState: /router.*state|Router.*State/.test(serverMessages), module: /Module not found|Cannot find module/.test(serverMessages) } }));
      assert.ok([200, 307].includes(r.status), "denied navigation is a redirect/Flight redirect, not a server failure");
      assert.equal(reads, beforeReads, "no data read before authentication"); assert.equal(signings, beforeSignings, "no signing before authentication"); checked++;
    }
    const api = `/api/admin/stories/media/${s.hero_media_id}/preview-url?storyId=${s.id}`;
    for (const cookie of sessions.slice(0, 3)) {
      const beforeReads = reads, beforeSignings = signings;
      const r = await fetch(origin + api, { headers: cookie ? { Cookie: cookie } : {}, redirect: "manual" }); const text = await r.text();
      assert.equal(r.status, 401); assert.ok(noPrivate(text)); assert.ok(r.headers.get("cache-control")?.includes("no-store"));
      assert.equal(reads, beforeReads); assert.equal(signings, beforeSignings); checked++;
    }
    const allowed = await fetch(origin + `/admin/historias/${s.id}/preview`, { headers: { Cookie: `${ADMIN_SESSION_COOKIE}=${valid}` }, redirect: "manual" });
    const allowedText = await allowed.text(); assert.equal(allowed.status, 200);
    assert.ok(allowedText.includes(s.title) && allowedText.includes("SYNTHETIC_PRIVATE_BODY") && allowedText.includes("data-story-article"), "authorized private Preview retains the actual Article");
    assert.ok(allowedText.includes("/object/sign/story-media-drafts/"), "authorized Preview resolves its private media");
    assert.ok(allowed.headers.get("cache-control")?.includes("no-store")); assert.ok(/noindex/.test(allowedText));
    const pub = await fetch(origin + `/historias/${s.slug}`, { redirect: "manual" }); const pubText = await pub.text();
    assert.equal(pub.status, 404); assert.ok(noPrivate(pubText), "all non-PUBLISHED public slugs remain private");
  }
  t.diagnostic(`STORIES_HTTP_SECURITY_NEGATIVE_RESPONSES=${checked}`);
  t.diagnostic("STORIES_HTML_FLIGHT_PREFETCH_NAVIGATION_AUXILIARY_GATES=PASS");
  t.diagnostic("STORIES_VALID_SESSION_PREVIEW_AND_NO_STORE=PASS");
  await t.test("canonical sitemap reflects publication, updated lastmod and archival without another build", async () => {
    const prerender = JSON.parse(readFileSync(".next/prerender-manifest.json", "utf8"));
    assert.equal(prerender.routes["/sitemap.xml"], undefined, "sitemap is not a prerendered/ISR snapshot");
    const storyUrl = `https://www.eventomotor.com/historias/${sitemapStory.slug}`;
    const locations = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    const readSitemap = async () => {
      // Deliberately no query, cookies, cache-busting headers or revalidation call.
      const response = await fetch(`${origin}/sitemap.xml`);
      const xml = await response.text();
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") ?? "", /xml/);
      assert.ok(noPrivate(xml), "sitemap contains no private content or signed locators");
      const urls = locations(xml);
      assert.equal(new Set(urls).size, urls.length, "no duplicate canonical URLs");
      for (const story of stories) assert.ok(!urls.includes(`https://www.eventomotor.com/historias/${story.slug}`));
      return { xml, urls, cacheControl: response.headers.get("cache-control") ?? "" };
    };
    const before = await readSitemap();
    assert.ok(!before.urls.includes(storyUrl), "DRAFT is excluded");
    assert.ok(before.urls.includes("https://www.eventomotor.com/evento/synthetic-http-fixture-event"));
    assert.ok(before.urls.some((url) => url.includes("/disciplinas/")));
    assert.ok(before.urls.some((url) => url.includes("/zonas/")));
    sitemapStory.status = "READY";
    assert.deepEqual((await readSitemap()).urls, before.urls, "READY is excluded");
    sitemapStory.status = "PUBLISHED";
    sitemapStory.published_at = "2030-01-02T12:00:00Z";
    sitemapStory.updated_at = "2030-01-02T12:00:00Z";
    const published = await readSitemap();
    assert.ok(published.urls.includes(storyUrl), "publication appears on the very next canonical request");
    // Next's metadata handler emits this header even for force-dynamic routes.
    // Zero freshness plus must-revalidate, not a fabricated no-store header.
    assert.match(published.cacheControl, /max-age=0/);
    assert.match(published.cacheControl, /must-revalidate/);
    assert.doesNotMatch(published.cacheControl, /s-maxage=[1-9]|stale-while-revalidate/);
    assert.deepEqual(published.urls.filter((url) => url !== storyUrl), before.urls, "all existing event, taxonomy and static URLs are preserved");
    const home = await fetch(origin + "/");
    const homeHtml = await home.text();
    assert.equal(home.status, 200);
    assert.ok(homeHtml.includes("data-home-stories") && homeHtml.includes(sitemapStory.title));
    assert.ok(homeHtml.includes(`href="/historias/${sitemapStory.slug}"`));
    assert.ok(!/story-media-drafts|\/object\/sign\/|rights_notes|SYNTHETIC_PRIVATE_BODY/.test(homeHtml), "Home only serializes published header/hero, never private article content");
    sitemapStory.updated_at = "2030-01-03T13:00:00Z";
    const updated = await readSitemap();
    const entry = updated.xml.split("<url>").find((part) => part.includes(`<loc>${storyUrl}</loc>`));
    assert.ok(entry?.includes("<lastmod>2030-01-03T13:00:00.000Z</lastmod>"), "lastmod is not a stale published snapshot");
    assert.deepEqual(updated.urls, published.urls);
    sitemapStory.status = "ARCHIVED";
    assert.deepEqual((await readSitemap()).urls, before.urls, "archival disappears on the next request without disturbing other URLs");
    const emptyHome = await fetch(origin + "/");
    assert.ok(!(await emptyHome.text()).includes("data-home-stories"), "no published Story means no empty Home module");
    t.diagnostic("STORIES_CANONICAL_SITEMAP_PUBLICATION_UPDATE_ARCHIVAL=PASS");
    t.diagnostic("STORIES_SITEMAP_EXISTING_URLS_AND_PRIVACY=PASS");
  });
});
