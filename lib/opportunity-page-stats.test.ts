import assert from "node:assert/strict";
import test from "node:test";
import { buildOpportunityEventCountStat } from "@/lib/opportunity-page-stats";

test("el KPI principal muestra próximos cuando existe archivo", () => {
  assert.deepEqual(
    buildOpportunityEventCountStat({ totalCount: 19, upcomingCount: 12 }),
    { label: "Próximos", value: "12" },
  );
});

test("el KPI principal mantiene una etiqueta inequívoca cuando todos son próximos", () => {
  assert.deepEqual(
    buildOpportunityEventCountStat({ totalCount: 12, upcomingCount: 12 }),
    { label: "Próximos", value: "12" },
  );
});
