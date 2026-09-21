import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const worker = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
const registration = readFileSync(new URL("./ServiceWorkerRegistration.tsx", import.meta.url), "utf8");

test("V2 names its cache independently of the former V1 cache", () => {
  assert.match(worker, /^const CACHE_VERSION = "eventomotor-pwa-v2";/);
  assert.doesNotMatch(worker, /const CACHE_VERSION = "eventomotor-pwa-v1"/);
  assert.equal(worker.split(/\r?\n/)[1], "const STATIC_CACHE = `${CACHE_VERSION}-static`;");
});

test("install and activate create V2 cache, retire V1, and take control", async () => {
  const listeners = new Map<string, (event: unknown) => void>();
  const opened: string[] = [];
  const deleted: string[] = [];
  const precached: string[][] = [];
  let skipped = false;
  let claimed = false;

  runInNewContext(worker, {
    self: {
      addEventListener(name: string, listener: (event: unknown) => void) {
        listeners.set(name, listener);
      },
      skipWaiting: async () => { skipped = true; },
      clients: { claim: async () => { claimed = true; } },
    },
    caches: {
      open: async (name: string) => {
        opened.push(name);
        return { addAll: async (assets: string[]) => { precached.push([...assets]); } };
      },
      keys: async () => [
        "eventomotor-pwa-v1-static",
        "eventomotor-pwa-v2-static",
        "unrelated-existing-cache",
      ],
      delete: async (name: string) => {
        deleted.push(name);
        return true;
      },
    },
  });

  async function dispatch(name: string) {
    const listener = listeners.get(name);
    assert.ok(listener, `Missing ${name} handler`);
    let pending: Promise<unknown> | undefined;
    listener({ waitUntil(promise: Promise<unknown>) { pending = promise; } });
    assert.ok(pending, `Missing ${name} waitUntil`);
    await pending;
  }

  await dispatch("install");
  await dispatch("activate");

  assert.deepEqual(opened, ["eventomotor-pwa-v2-static"]);
  assert.deepEqual(precached, [[
    "/offline",
    "/manifest.webmanifest",
    "/brand/eventomotor-app-icon-192.png",
    "/brand/eventomotor-app-icon-512.png",
    "/brand/eventomotor-logo-horizontal-dark-header.png",
  ]]);
  assert.deepEqual(deleted, ["eventomotor-pwa-v1-static", "unrelated-existing-cache"]);
  assert.equal(skipped, true);
  assert.equal(claimed, true);
});

test("network-first navigation and existing static refresh whitelist remain unchanged", () => {
  assert.match(worker, /if \(request\.method !== "GET"\) return;/);
  assert.match(worker, /if \(url\.origin !== self\.location\.origin\) return;/);
  assert.match(worker, /url\.pathname\.startsWith\("\/admin"\)/);
  assert.match(worker, /url\.pathname\.startsWith\("\/api"\)/);
  assert.match(worker, /url\.pathname\.startsWith\("\/_next\/data"\)/);
  assert.match(worker, /if \(isAdminOrApi\(url\)\) return;/);
  assert.match(worker, /if \(request\.mode === "navigate"\) \{[\s\S]*?fetch\(request\)[\s\S]*?\.catch\(\(\) => caches\.match\(OFFLINE_URL\)\)/);
  assert.match(worker, /url\.pathname\.startsWith\("\/_next\/static"\)/);
  assert.match(worker, /url\.pathname\.startsWith\("\/brand\/"\)/);
  assert.match(worker, /url\.pathname\.startsWith\("\/images\/"\)/);
  assert.match(worker, /url\.pathname === "\/manifest\.webmanifest"/);
  assert.match(worker, /return cached \|\| networkFetch;/);
  assert.equal((worker.match(/event\.respondWith\(/g) ?? []).length, 2);
});

test("registration remains production-only, on load, at the original scope", () => {
  assert.match(registration, /if \(process\.env\.NODE_ENV !== "production"\) return;/);
  assert.match(registration, /window\.addEventListener\("load", \(\) => \{/);
  assert.match(registration, /navigator\.serviceWorker\.register\("\/sw\.js", \{ scope: "\/" \}\)/);
});
