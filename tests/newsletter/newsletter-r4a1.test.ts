import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const WORKFLOW_PATH = join(
  process.cwd(),
  ".github",
  "workflows",
  "newsletter-application-tests.yml",
);

test("CI R4A.1 valida la aplicación sin secretos, proveedores ni despliegues", async () => {
  const workflow = await readFile(WORKFLOW_PATH, "utf8");

  assert.match(workflow, /^name: Newsletter application tests$/m);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.match(workflow, /push:\s*\n\s+branches:\s*\n\s+- "feature\/newsletter-\*"/);
  assert.match(workflow, /pull_request:\s*\n\s+branches:\s*\n\s+- main/);
  assert.match(workflow, /cancel-in-progress: true/);
  assert.match(workflow, /uses: actions\/checkout@v7/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /uses: actions\/setup-node@v7[\s\S]+node-version: 24/);
  assert.match(workflow, /cache: npm/);
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /NEWSLETTER_MODE: "off"/);
  assert.match(workflow, /NEWSLETTER_MAIL_TRANSPORT: "disabled"/);

  const orderedSteps = [
    "Install dependencies",
    "R4A tests",
    "Standard application tests",
    "React-server tests",
    "Typecheck",
    "Build",
  ];
  let previousIndex = -1;
  for (const step of orderedSteps) {
    const index = workflow.indexOf(`- name: ${step}`);
    assert.ok(index > previousIndex, `${step} must preserve the required workflow order`);
    previousIndex = index;
  }

  assert.match(workflow, /npm run test:newsletter-r4a/);
  assert.match(workflow, /node --import tsx --test "\$\{standard_tests\[@\]\}"/);
  assert.match(workflow, /node --conditions=react-server --import tsx --test/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm run build/);

  assert.doesNotMatch(
    workflow,
    /pull_request_target|secrets\.|NEWSLETTER_RESEND_API_KEY|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_|supabase|docker|database\/migrations|db\s+(?:push|reset)|\.env\.local|smtp|curl|wget|upload-artifact|deploy|vercel|workflow_dispatch/i,
  );
  assert.doesNotMatch(workflow, /(?:^|\s)(?:env|printenv)\s/m);
});
