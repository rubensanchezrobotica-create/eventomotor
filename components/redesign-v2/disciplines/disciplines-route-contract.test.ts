import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const route = source("app/preview/redesign-v2/disciplinas/page.tsx");
const component = source("components/redesign-v2/disciplines/DisciplinesPage.tsx");
const model = source("components/redesign-v2/disciplines/disciplines-model.ts");
const styles = source("components/redesign-v2/disciplines/DisciplinesPage.module.css");
const compactSignup = source("components/redesign-v2/newsletter/CompactAgendaSignup.client.tsx");
const compactSignupStyles = source("components/redesign-v2/newsletter/CompactAgendaSignup.module.css");
const sitemap = source("app/sitemap.ts");

test("A5 es server-first y consulta el loader visible exactamente una vez", () => {
  assert.match(route, /await connection\(\)/);
  assert.equal((route.match(/getVisibleEvents\(\)/g) || []).length, 1);
  assert.match(route, /buildDisciplinesPageModel/);
  assert.match(route, /<V2PreviewShell/);
  assert.match(route, /<DisciplinesPage model=\{model\}/);
  assert.doesNotMatch(route, /["']use client["']/);
  assert.doesNotMatch(component, /["']use client["']/);
});

test("A5 es noindex, nofollow y nocache sin canonical, JSON-LD ni sitemap", () => {
  assert.match(route, /index:\s*false/);
  assert.match(route, /follow:\s*false/);
  assert.match(route, /nocache:\s*true/);
  assert.doesNotMatch(route, /canonical|application\/ld\+json|generateMetadata/);
  assert.doesNotMatch(sitemap, /preview\/redesign-v2\/disciplinas/);
});

test("A5 reutiliza la taxonomía real, clasificación pública y fecha Europe/Madrid", () => {
  assert.match(model, /SEO_DISCIPLINES\.map/);
  assert.match(model, /classifyEventDisciplinePage/);
  assert.match(model, /madridCalendarDateKey/);
  assert.match(model, /isCalendarDateKey/);
  assert.match(model, /event\.visible === false/);
  assert.match(model, /event\.slug \|\| event\.id/);
  assert.doesNotMatch(model, /Math\.random|Date\.now/);
});

test("A5 enlaza las ocho tarjetas completas a detalle público sin controles anidados", () => {
  assert.match(component, /model\.cards\.map/);
  assert.match(component, /<Link className=\{styles\.card\} href=\{card\.href\}>/);
  assert.match(component, /<h3>\{card\.label\}<\/h3>/);
  assert.doesNotMatch(component, /<button|onClick=/);
  assert.doesNotMatch(model, /preview\/redesign-v2\/disciplina/);
  assert.match(model, /href: `\/disciplinas\/\$\{discipline\.slug\}`/);
});

test("A5 protege tactilidad, foco, responsive, overflow y movimiento reducido", () => {
  const titleStyles = styles.match(/\.cardBody > h3\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(styles, /min-height:\s*44px/);
  assert.match(styles, /min-width:\s*0/);
  assert.match(styles, /overflow:\s*hidden/);
  assert.match(titleStyles, /overflow-wrap:\s*normal/);
  assert.match(titleStyles, /white-space:\s*nowrap/);
  assert.doesNotMatch(titleStyles, /overflow-wrap:\s*anywhere|word-break:\s*break-all/);
  assert.match(styles, /@media \(max-width: 1120px\)/);
  assert.match(styles, /@media \(max-width: 860px\)/);
  assert.match(styles, /@media \(max-width: 560px\)/);
  assert.match(styles, /@media \(max-width: 350px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("A5 elimina la introducción redundante y conserva el CTA de Calendar", () => {
  assert.doesNotMatch(component, /Explora por pasión|Ocho puertas de entrada|Los contadores reflejan/);
  assert.match(component, /Elige tu disciplina/);
  assert.match(component, /¿Prefieres empezar por la fecha\?/);
  assert.match(component, /Consulta toda la agenda por fecha y descubre los próximos eventos del motor\./);
  assert.doesNotMatch(component, /canónic[oa]|asignada|assigned/i);
  assert.match(component, /<CompactAgendaSignup/);
});

test("A5.1 reutiliza el contrato real de newsletter sin provincia ni endpoint alternativo", () => {
  assert.match(compactSignup, /requestNewsletterSubscription/);
  assert.match(compactSignup, /runNewsletterMutationOnce/);
  assert.match(compactSignup, /validateNewsletterPreviewForm\(email, ""\)/);
  assert.match(compactSignup, /NEWSLETTER_CONSENT_VERSION/);
  assert.match(compactSignup, /type="email"/);
  assert.match(compactSignup, /type="checkbox"/);
  assert.match(compactSignup, /\/privacidad/);
  assert.match(compactSignup, /\/aviso-legal/);
  assert.doesNotMatch(compactSignup, /province:|<select|api\/newsletter-v2|source:|origin:/);
  assert.match(compactSignupStyles, /min-height:\s*48px/);
  assert.match(compactSignupStyles, /@media \(max-width: 900px\)/);
  assert.match(compactSignupStyles, /@media \(max-width: 560px\)/);
});

test("A5.1 conserva validación, estados accesibles y éxito de doble opt-in", () => {
  assert.match(compactSignup, /if \(!consent\)/);
  assert.match(compactSignup, /aria-busy=\{busy\}/);
  assert.match(compactSignup, /aria-live="polite"/);
  assert.match(compactSignup, /role=\{state === "invalid" \? "alert" : "status"\}/);
  assert.match(compactSignup, /Solicitud recibida/);
  assert.match(compactSignup, /correo de confirmación/);
  assert.match(compactSignup, /validating|submitting|accepted|rate_limited|temporarily_unavailable/);
});

test("A5.2 ordena email, consentimiento y envío de forma estructural", () => {
  const emailPosition = compactSignup.indexOf('type="email"');
  const consentPosition = compactSignup.indexOf('type="checkbox"');
  const submitPosition = compactSignup.indexOf('className={styles.submit}');

  assert.ok(emailPosition >= 0);
  assert.ok(consentPosition > emailPosition);
  assert.ok(submitPosition > consentPosition);
  assert.match(compactSignup, /const \[consent, setConsent\] = useState\(false\)/);
  assert.match(compactSignup, /if \(!consent\)/);
  assert.doesNotMatch(compactSignup, /checked=\{true\}|defaultChecked/);
});

test("A5 no introduce datos demo, SEO largo ni assets nuevos", () => {
  assert.doesNotMatch(route, /newsletter|supabase|resend/i);
  assert.match(model, /\/images\/disciplines\/icons\/web\/discipline-rallyes\.png/);
  assert.doesNotMatch(component, /dangerouslySetInnerHTML/);
});
