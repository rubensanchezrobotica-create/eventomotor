import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";
import { FALLBACK_EVENTS } from "@/lib/fallback-events";
import {
  getVisibleEvents,
  getVisibleEventsStrict,
} from "@/lib/public-events";
import type { EventRow } from "@/lib/supabase";

const ISR_SECONDS = 21600;
const STATIC_ISR_ROUTES = [
  "eventos-motor-barcelona",
  "eventos-motor-valencia",
  "ferias-motor-espana-2026",
  "karting-espana-2026",
  "motoalmuerzos-2026",
  "rallyes-espana-2026",
  "rallyes-valencia-2026",
  "rallysprint-espana-2026",
  "rodadas-moto-2026",
  "trackdays-espana-2026",
] as const;

const DYNAMIC_ROUTES = [
  "concentraciones-moteras-2026",
  "concentraciones-moteras-este-fin-de-semana",
  "eventos-motor-andalucia",
  "eventos-motor-aragon",
  "eventos-motor-asturias",
  "eventos-motor-baleares",
  "eventos-motor-canarias",
  "eventos-motor-cantabria",
  "eventos-motor-castilla-la-mancha",
  "eventos-motor-castilla-y-leon",
  "eventos-motor-cataluna",
  "eventos-motor-comunidad-valenciana",
  "eventos-motor-este-fin-de-semana",
  "eventos-motor-extremadura",
  "eventos-motor-galicia",
  "eventos-motor-madrid",
  "eventos-motor-murcia",
  "eventos-motor-navarra",
  "eventos-motor-pais-vasco",
] as const;

function routeSource(route: string) {
  const file = join(process.cwd(), "app", route, "page.tsx");
  return ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function exportedNumericConstant(source: ts.SourceFile, name: string) {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const isExported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!isExported) continue;

    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name)
        && declaration.name.text === name
        && declaration.initializer
        && ts.isNumericLiteral(declaration.initializer)
      ) {
        return Number(declaration.initializer.text);
      }
    }
  }

  return null;
}

function jsxAttributeCount(source: ts.SourceFile, name: string) {
  let count = 0;

  function visit(node: ts.Node) {
    if (ts.isJsxAttribute(node) && node.name.getText(source) === name) {
      count += 1;
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return count;
}

const SUCCESS_ROW: EventRow = {
  id: "freshness-test-event",
  slug: "freshness-test-event-2026-09-09",
  title: "Freshness test event",
  championship: null,
  discipline: "Rally",
  start_date: "2026-09-09",
  end_date: "2026-09-09",
  venue: "Test venue",
  city: "Test city",
  province: "Madrid",
  region: "Madrid",
  level: null,
  source: "Test",
  source_url: "https://example.com/event",
  ticket_url: null,
  tags: ["test"],
  vehicle_type: "coche",
  featured: false,
  visible: true,
  import_method: null,
  data_quality: "reviewed",
  notes: null,
  created_at: "2026-09-09T00:00:00.000Z",
  updated_at: "2026-09-09T00:00:00.000Z",
};

async function withSupabaseResponse<T>(
  body: unknown,
  status: number,
  action: () => Promise<T>,
) {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  globalThis.fetch = (async () => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })) as typeof fetch;

  try {
    return await action();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
}

test("exactamente las diez rutas estáticas usan ISR 6h y carga estricta", () => {
  assert.equal(STATIC_ISR_ROUTES.length, 10);

  for (const route of STATIC_ISR_ROUTES) {
    const source = routeSource(route);
    assert.equal(exportedNumericConstant(source, "revalidate"), ISR_SECONDS, route);
    assert.equal(jsxAttributeCount(source, "strictData"), 1, route);
  }
});

test("las diecinueve rutas dinámicas no reciben ISR ni carga estricta", () => {
  assert.equal(DYNAMIC_ROUTES.length, 19);

  for (const route of DYNAMIC_ROUTES) {
    const source = routeSource(route);
    assert.equal(exportedNumericConstant(source, "revalidate"), null, route);
    assert.equal(jsxAttributeCount(source, "strictData"), 0, route);
  }
});

test("el loader estricto devuelve eventos cuando Supabase responde", async () => {
  const events = await withSupabaseResponse([SUCCESS_ROW], 200, getVisibleEventsStrict);

  assert.equal(events.length, 1);
  assert.equal(events[0].id, SUCCESS_ROW.id);
});

test("el loader estricto propaga un error de consulta", async () => {
  await assert.rejects(
    withSupabaseResponse(
      { code: "TEST_ERROR", message: "forced query failure" },
      500,
      getVisibleEventsStrict,
    ),
    /visible-events query failed/,
  );
});

test("el loader estricto rechaza un inventario vacío inesperado", async () => {
  await assert.rejects(
    withSupabaseResponse([], 200, getVisibleEventsStrict),
    /unexpected empty result/,
  );
});

test("el loader tolerante conserva fallback ante error y vacío", async () => {
  const expectedIds = FALLBACK_EVENTS
    .filter((event) => event.visible !== false)
    .map((event) => event.id);
  const queryErrorEvents = await withSupabaseResponse(
    { code: "TEST_ERROR", message: "forced query failure" },
    500,
    getVisibleEvents,
  );
  const emptyEvents = await withSupabaseResponse([], 200, getVisibleEvents);

  assert.deepEqual(queryErrorEvents.map((event) => event.id), expectedIds);
  assert.deepEqual(emptyEvents.map((event) => event.id), expectedIds);
});
