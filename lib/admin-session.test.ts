import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  AdminSessionError,
  adminSessionClearCookieOptions,
  adminSessionCookieOptions,
  assertValidAdminSessionToken,
  createAdminSessionToken,
  isTrustedAdminMutationOrigin,
  safeAdminNext,
  verifyAdminCredential,
  verifyAdminSessionToken,
} from "./admin-session";

const SECRET = "synthetic-admin-secret-that-never-leaves-the-server";
const NOW = Date.UTC(2026, 9, 5, 10, 0, 0);

test("valid login credential compares successfully", () => {
  assert.equal(verifyAdminCredential(SECRET, SECRET), true);
});

test("invalid login credential is rejected", () => {
  assert.equal(verifyAdminCredential("wrong", SECRET), false);
});

test("a valid signed session is accepted before its fixed expiry", () => {
  const token = createAdminSessionToken(SECRET, NOW, "abcdefghijklmnop");
  assert.equal(verifyAdminSessionToken(token, SECRET, NOW + 60_000), true);
});

test("an expired session is rejected without sliding expiration", () => {
  const token = createAdminSessionToken(SECRET, NOW, "abcdefghijklmnop");
  assert.equal(
    verifyAdminSessionToken(token, SECRET, NOW + ADMIN_SESSION_TTL_SECONDS * 1_000),
    false,
  );
});

test("a tampered cookie is rejected", () => {
  const token = createAdminSessionToken(SECRET, NOW, "abcdefghijklmnop");
  assert.equal(verifyAdminSessionToken(`${token}x`, SECRET, NOW), false);
});

test("rotating ADMIN_SECRET invalidates existing sessions", () => {
  const token = createAdminSessionToken(SECRET, NOW, "abcdefghijklmnop");
  assert.equal(verifyAdminSessionToken(token, `${SECRET}-rotated`, NOW), false);
});

test("the session cookie never contains the admin credential", () => {
  const token = createAdminSessionToken(SECRET, NOW, "abcdefghijklmnop");
  assert.equal(token.includes(SECRET), false);
});

test("cookie flags match the eight-hour strict admin contract", () => {
  assert.equal(ADMIN_SESSION_COOKIE, "eventomotor_admin_session");
  assert.deepEqual(adminSessionCookieOptions("production"), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/admin",
    maxAge: 28_800,
  });
  assert.equal(adminSessionCookieOptions("development").secure, false);
});

test("logout expires the same protected admin cookie", () => {
  const options = adminSessionClearCookieOptions("production");
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, "strict");
  assert.equal(options.path, "/admin");
  assert.equal(options.maxAge, 0);
  assert.equal(options.expires.getTime(), 0);
});

test("a protected action rejects a missing session", () => {
  assert.throws(
    () => assertValidAdminSessionToken(null, SECRET, NOW),
    AdminSessionError,
  );
});

test("unsafe external and protocol-relative next targets fail closed", () => {
  assert.equal(safeAdminNext("https://evil.example/admin"), "/admin/historias");
  assert.equal(safeAdminNext("//evil.example/admin"), "/admin/historias");
  assert.equal(safeAdminNext("/public"), "/admin/historias");
  assert.equal(safeAdminNext("/administrator"), "/admin/historias");
  assert.equal(safeAdminNext("/admin/historias/abc?tab=seo"), "/admin/historias/abc?tab=seo");
});

test("normalized admin next targets remain confined to the admin tree", () => {
  for (const accepted of [
    "/admin",
    "/admin/",
    "/admin/historias",
    "/admin/historias/abc",
    "/admin/historias?x=1",
  ]) {
    assert.equal(safeAdminNext(accepted), accepted);
  }
  for (const rejected of [
    "/admin/../",
    "/admin/../evento",
    "/admin/%2e%2e/evento",
    "/admin/%2E%2E/evento",
    "/admin/foo/../../evento",
    "/admin\\..\\evento",
    "/admin/%2f../evento",
    "/admin/%5c../evento",
  ]) {
    assert.equal(safeAdminNext(rejected), "/admin/historias");
  }
});

test("admin mutations accept only the current same-origin host", () => {
  assert.equal(
    isTrustedAdminMutationOrigin("https://eventomotor.com", "eventomotor.com"),
    true,
  );
  assert.equal(
    isTrustedAdminMutationOrigin("https://evil.example", "eventomotor.com"),
    false,
  );
  assert.equal(isTrustedAdminMutationOrigin(null, "eventomotor.com"), false);
});
