import assert from "node:assert/strict";
import test from "node:test";
import { isEventDetailPreviewAvailable } from "./event-detail-preview-access";

test("la preview solo se bloquea en el deployment de producción de Vercel", () => {
  assert.equal(isEventDetailPreviewAvailable("production"), false);
  assert.equal(isEventDetailPreviewAvailable("preview"), true);
  assert.equal(isEventDetailPreviewAvailable("development"), true);
  assert.equal(isEventDetailPreviewAvailable(undefined), true);
});
