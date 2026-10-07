import assert from "node:assert/strict";
import test from "node:test";
import nextConfig from "../next.config";
import { getEventSeoOverride } from "./event-seo-overrides";

const survivor = "/evento/rally-de-caceres-2026-11-30";
const retiredRoutes = [
  "/evento/rallye-tierra-de-caceres-2026-10-02",
  "/evento/rallye-de-tierra-de-caceres-2026-10-02",
  "/evento/rallye-tierra-tierra-caceres-2026-10-02",
];

test("Cáceres legacy routes redirect directly and permanently to the survivor", async () => {
  const redirects = await nextConfig.redirects?.();
  assert.ok(redirects);

  for (const source of retiredRoutes) {
    const matches: Array<{ source: string; destination: string; statusCode?: number }> =
      redirects.filter((redirect) => redirect.source === source);
    assert.equal(matches.length, 1, source);
    assert.equal(matches[0].destination, survivor);
    assert.equal("statusCode" in matches[0] ? matches[0].statusCode : null, 301);
  }

  assert.ok(!redirects.some((redirect) => redirect.source === survivor));
});

test("Cáceres factual meta describes the completed October event", () => {
  const override = getEventSeoOverride("rally-de-caceres-2026-11-30");
  assert.ok(override?.seoDescription);
  assert.match(override.seoDescription, /se celebró el 2 y 3 de octubre/);
  assert.doesNotMatch(override.seoDescription, /previsto|noviembre|30\/11|01\/12/i);
});
