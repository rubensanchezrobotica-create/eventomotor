import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  confirmNewsletterSubscription,
  requestNewsletterSubscription,
  runNewsletterMutationOnce,
  unsubscribeNewsletterSubscription,
  type NewsletterFetch,
} from "@/lib/newsletter/http-client";

const projectRoot = process.cwd();
const VALID_TOKEN = "a".repeat(43);

function source(path: string): string {
  return readFileSync(join(projectRoot, path), "utf8");
}

function walkFiles(path: string): string[] {
  const absolute = join(projectRoot, path);
  return readdirSync(absolute).flatMap((name) => {
    const child = join(absolute, name);
    return statSync(child).isDirectory() ? walkFiles(join(path, name)) : [child];
  });
}

function jsonResponse(body: object, status: number): Response {
  return Response.json(body, { status });
}

function requestPayload() {
  return {
    email: "driver@example.invalid",
    province: "madrid",
    consentVersion: "2026-07",
  };
}

test("request usa POST same-origin, JSON, no-store y el payload exacto", async () => {
  let calls = 0;
  const fetcher: NewsletterFetch = async (input, init) => {
    calls += 1;
    assert.equal(input, "/api/newsletter/request");
    assert.equal(init?.method, "POST");
    assert.deepEqual(init?.headers, { "Content-Type": "application/json" });
    assert.equal(init?.credentials, "same-origin");
    assert.equal(init?.cache, "no-store");
    assert.deepEqual(JSON.parse(String(init?.body)), requestPayload());
    assert.ok(init?.signal instanceof AbortSignal);
    return jsonResponse({ ok: true, status: "accepted" }, 202);
  };

  assert.equal(
    await requestNewsletterSubscription(requestPayload(), { fetcher }),
    "accepted",
  );
  assert.equal(calls, 1);
});

test("request mapea exclusivamente los estados HTTP públicos", async (context) => {
  const cases = [
    [400, { ok: false, error: "invalid_request" }, "invalid"],
    [413, { ok: false, error: "payload_too_large" }, "invalid"],
    [415, { ok: false, error: "unsupported_media_type" }, "invalid"],
    [404, { ok: false, error: "not_found" }, "unavailable"],
    [429, { ok: false, error: "rate_limited" }, "rate_limited"],
    [503, { ok: false, error: "temporarily_unavailable" }, "temporarily_unavailable"],
  ] as const;

  for (const [status, body, expected] of cases) {
    await context.test(String(status), async () => {
      const actual = await requestNewsletterSubscription(requestPayload(), {
        fetcher: async () => jsonResponse(body, status),
      });
      assert.equal(actual, expected);
    });
  }
});

test("request trata body vacío, JSON inválido y contrato desconocido como error temporal", async () => {
  for (const response of [
    new Response(null, { status: 202 }),
    new Response("{", { status: 202 }),
    jsonResponse({ ok: true, status: "internal_outcome" }, 202),
    jsonResponse({ ok: false, error: "sql_failed" }, 500),
  ]) {
    const result = await requestNewsletterSubscription(requestPayload(), {
      fetcher: async () => response.clone(),
    });
    assert.equal(result, "temporarily_unavailable");
  }
});

test("request maneja pérdida de red sin reintentar ni registrar datos", async () => {
  let calls = 0;
  const result = await requestNewsletterSubscription(requestPayload(), {
    fetcher: async () => {
      calls += 1;
      throw new TypeError("network unavailable");
    },
  });
  assert.equal(result, "temporarily_unavailable");
  assert.equal(calls, 1);
});

test("request cancela por timeout y no reintenta", async () => {
  let calls = 0;
  const fetcher: NewsletterFetch = async (_input, init) => {
    calls += 1;
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("aborted", "AbortError")),
        { once: true },
      );
    });
  };
  const result = await requestNewsletterSubscription(requestPayload(), {
    fetcher,
    timeoutMs: 5,
  });
  assert.equal(result, "temporarily_unavailable");
  assert.equal(calls, 1);
});

test("request respeta cancelación externa", async () => {
  const controller = new AbortController();
  let calls = 0;
  const promise = requestNewsletterSubscription(requestPayload(), {
    signal: controller.signal,
    fetcher: async (_input, init) => {
      calls += 1;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          { once: true },
        );
      });
    },
  });
  controller.abort();
  assert.equal(await promise, "temporarily_unavailable");
  assert.equal(calls, 1);
});

test("el bloqueo single-flight evita una segunda mutación simultánea", async () => {
  const lock = { current: false };
  let calls = 0;
  let release: (() => void) | undefined;
  const operation = () =>
    runNewsletterMutationOnce(lock, async () => {
      calls += 1;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return "accepted";
    });

  const first = operation();
  const second = operation();
  assert.equal(await second, undefined);
  assert.equal(calls, 1);
  release?.();
  assert.equal(await first, "accepted");
});

test("confirm sólo envía token por POST y mapea sus tres outcomes públicos", async (context) => {
  for (const expected of ["confirmed", "already_confirmed", "invalid_or_expired"] as const) {
    await context.test(expected, async () => {
      let calls = 0;
      const actual = await confirmNewsletterSubscription(VALID_TOKEN, {
        fetcher: async (input, init) => {
          calls += 1;
          assert.equal(input, "/api/newsletter/confirm");
          assert.deepEqual(JSON.parse(String(init?.body)), { token: VALID_TOKEN });
          return jsonResponse({ ok: true, status: expected }, 200);
        },
      });
      assert.equal(actual, expected);
      assert.equal(calls, 1);
    });
  }
});

test("confirm mapea guard, error de payload y fallo temporal sin filtrar detalles", async (context) => {
  const cases = [
    [404, { ok: false, error: "not_found" }, "unavailable"],
    [400, { ok: false, error: "invalid_request" }, "invalid_or_expired"],
    [503, { ok: false, error: "temporarily_unavailable" }, "temporarily_unavailable"],
  ] as const;
  for (const [status, body, expected] of cases) {
    await context.test(String(status), async () => {
      assert.equal(
        await confirmNewsletterSubscription(VALID_TOKEN, {
          fetcher: async () => jsonResponse(body, status),
        }),
        expected,
      );
    });
  }
});

test("unsubscribe sólo envía token y conserva idempotencia pública", async (context) => {
  for (const expected of ["unsubscribed", "already_unsubscribed", "invalid_or_expired"] as const) {
    await context.test(expected, async () => {
      let calls = 0;
      const actual = await unsubscribeNewsletterSubscription(VALID_TOKEN, {
        fetcher: async (input, init) => {
          calls += 1;
          assert.equal(input, "/api/newsletter/unsubscribe");
          assert.deepEqual(JSON.parse(String(init?.body)), { token: VALID_TOKEN });
          assert.equal("email" in JSON.parse(String(init?.body)), false);
          return jsonResponse({ ok: true, status: expected }, 200);
        },
      });
      assert.equal(actual, expected);
      assert.equal(calls, 1);
    });
  }
});

test("el formulario contiene estados, consentimiento y validación UX accesible", () => {
  const form = source("components/newsletter/NewsletterSignupForm.tsx");
  for (const state of [
    "idle",
    "validating",
    "submitting",
    "accepted",
    "invalid",
    "unavailable",
    "rate_limited",
    "temporarily_unavailable",
  ]) {
    assert.match(form, new RegExp(`"${state}"`));
  }
  assert.match(form, /NEWSLETTER_CONSENT_VERSION/);
  assert.match(form, /type="checkbox"/);
  assert.match(form, /checked=\{consent\}/);
  assert.match(form, /aria-invalid/);
  assert.match(form, /aria-describedby/);
  assert.match(form, /aria-live="polite"/);
  assert.match(form, /inputMode="email"/);
  assert.match(form, /Introduce un correo válido/);
  assert.match(form, /Provincia — opcional/);
  assert.match(form, /Debes aceptar la información de privacidad para suscribirte/);
  assert.match(form, /Si la solicitud puede completarse, recibirás un mensaje/);
  assert.match(form, /Revisa tu correo/);
  assert.doesNotMatch(form, /Te hemos enviado un enlace/);
});

test("confirm y unsubscribe no mutan durante render y exigen acción explícita", () => {
  const component = source("components/newsletter/NewsletterTokenAction.tsx");
  const model = source("components/newsletter/newsletter-token-action-model.ts");
  assert.match(component, /onClick=\{submitAction\}/);
  assert.match(component, /type="button"/);
  assert.match(component, /Confirmar suscripción/);
  assert.match(component, /Sí, darme de baja/);
  assert.match(model, /Confirma tu dirección para activar tu suscripción/);
  assert.match(model, /Puedes cerrar esta página si prefieres mantener tu suscripción/);
  const captureEffect = component.slice(
    component.indexOf("useEffect(() => {"),
    component.indexOf("}, [kind]);"),
  );
  assert.doesNotMatch(
    captureEffect,
    /confirmNewsletterSubscription\(|unsubscribeNewsletterSubscription\(/,
  );
});

test("el token se captura en memoria y se retira de la URL visible", () => {
  const component = source("components/newsletter/NewsletterTokenAction.tsx");
  assert.match(component, /tokenRef = useRef<string \| null>/);
  assert.match(component, /searchParams\.get\("token"\)/);
  assert.match(component, /history\.replaceState/);
  assert.match(component, /window\.location\.pathname/);
  assert.doesNotMatch(component, /localStorage|sessionStorage|document\.cookie|console\./);
  assert.doesNotMatch(component, /dangerouslySetInnerHTML/);
});

test("las páginas sensibles heredan noindex, nofollow, noarchive y no-referrer", () => {
  const model = source("components/newsletter/newsletter-preview-model.ts");
  assert.match(model, /referrer:\s*"no-referrer"/);
  assert.match(model, /index:\s*false/);
  assert.match(model, /follow:\s*false/);
  assert.match(model, /noarchive:\s*true/);
  assert.match(source("app/preview/newsletter/confirm/page.tsx"), /kind="confirm"/);
  assert.match(source("app/preview/newsletter/unsubscribe/page.tsx"), /kind="unsubscribe"/);
});

test("analytics queda excluida por completo en las dos rutas con token", () => {
  const analytics = source("components/analytics/GoogleAnalytics.tsx");
  assert.match(analytics, /"\/preview\/newsletter\/confirm"/);
  assert.match(analytics, /"\/preview\/newsletter\/unsubscribe"/);
  assert.match(analytics, /isAnalyticsExcludedPath\(pathname\)/);
  assert.match(analytics, /if \(isAnalyticsExcludedPath\(pathname\)\) return null/);
});

test("la preview mantiene guard fail-closed compartido para las tres páginas", () => {
  const layout = source("app/preview/newsletter/layout.tsx");
  assert.match(layout, /isNewsletterPreviewAvailable/);
  assert.match(layout, /process\.env\.NEWSLETTER_MODE/);
  assert.match(layout, /process\.env\.VERCEL_ENV/);
  assert.match(layout, /notFound\(\)/);
  assert.match(layout, /\{children\}/);
});

test("los clientes no importan servidor, repositorio, Supabase, crypto ni secretos", () => {
  const clientSources = [
    source("components/newsletter/NewsletterSignupForm.tsx"),
    source("components/newsletter/NewsletterTokenAction.tsx"),
    source("lib/newsletter/http-client.ts"),
  ].join("\n");
  assert.doesNotMatch(
    clientSources,
    /http\.server|service\.server|repository\.server|crypto\.server|@supabase|createClient|service[_-]?role|process\.env|from\s+["'][^"']*resend/i,
  );
  assert.doesNotMatch(clientSources, /console\.|localStorage|sessionStorage|document\.cookie/);
});

test("R3B.2 no crea rutas públicas, integraciones o contenido específico", () => {
  const scopedFiles = [
    ...walkFiles("app/preview/newsletter"),
    ...walkFiles("components/newsletter"),
    join(projectRoot, "lib/newsletter/http-client.ts"),
  ];
  const combined = scopedFiles
    .filter((path) => /\.(?:ts|tsx)$/.test(path) && !path.endsWith(".test.ts"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  const unrelatedCampaignTerm = ["la ", "ba", "\u00f1", "eza"].join("");
  assert.doesNotMatch(
    combined,
    new RegExp(
      `@supabase|createClient|service[_-]?role|from\\s+["'][^"']*resend|${unrelatedCampaignTerm}`,
      "i",
    ),
  );
  assert.doesNotMatch(combined, /\/api\/newsletter\/(?:request|confirm|unsubscribe)[\s\S]*method:\s*"GET"/);
});

test("la estructura visual mantiene foco, reduced motion y cortes responsive", () => {
  const css = source("components/newsletter/NewsletterPreview.module.css");
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /@media \(max-width: 430px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /\.tokenCard/);
  assert.match(css, /\.consentField/);
});

test("los endpoints R3B.1 permanecen mínimos y sólo exportan POST", () => {
  for (const operation of ["request", "confirm", "unsubscribe"]) {
    const route = source(`app/api/newsletter/${operation}/route.ts`);
    assert.match(route, /export const POST = createNewsletterHttpHandler/);
    assert.doesNotMatch(route, /export (?:async function|const) (?:GET|PUT|PATCH|DELETE)/);
  }
});
