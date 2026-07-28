import assert from "node:assert/strict";
import test from "node:test";
import { validateAdminRequest } from "./admin-api-auth";

test("rechaza una petición sin credencial admin", () => {
  const previous = process.env.ADMIN_SECRET;
  process.env.ADMIN_SECRET = "test-secret";
  try {
    assert.deepEqual(
      validateAdminRequest(new Request("https://eventomotor.com/api/admin/test")),
      { ok: false, status: 401, error: "No autorizado." },
    );
  } finally {
    if (previous === undefined) delete process.env.ADMIN_SECRET;
    else process.env.ADMIN_SECRET = previous;
  }
});

test("acepta la credencial admin real del entorno sin devolverla", () => {
  const previous = process.env.ADMIN_SECRET;
  process.env.ADMIN_SECRET = "test-secret";
  try {
    assert.deepEqual(
      validateAdminRequest(new Request("https://eventomotor.com/api/admin/test", {
        headers: { authorization: "Bearer test-secret" },
      })),
      { ok: true },
    );
  } finally {
    if (previous === undefined) delete process.env.ADMIN_SECRET;
    else process.env.ADMIN_SECRET = previous;
  }
});

test("rechaza un origen cruzado aunque el bearer sea válido", () => {
  const previous = process.env.ADMIN_SECRET;
  process.env.ADMIN_SECRET = "test-secret";
  try {
    const result = validateAdminRequest(new Request("https://eventomotor.com/api/admin/test", {
      headers: {
        authorization: "Bearer test-secret",
        origin: "https://example.com",
      },
    }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 403);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_SECRET;
    else process.env.ADMIN_SECRET = previous;
  }
});
