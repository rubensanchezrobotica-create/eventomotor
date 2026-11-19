import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { test } from "node:test";
import { once } from "node:events";

import { withSafeGet } from "./http.mjs";

async function withStreamingServer(run) {
  const server = createServer((request, response) => {
    response.writeHead(request.url === "/bad" ? 404 : 200, { "content-type": "text/plain" });
    response.write("stream-start\n");
    const interval = setInterval(() => response.write("stream-continues\n"), 50);
    response.on("close", () => clearInterval(interval));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function runChildAndRequireExit(code) {
  const child = spawn(process.execPath, ["--input-type=module", "--eval", code], {
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
  child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
  const result = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      resolve({ timedOut: true, code: null });
    }, 6_000);
    child.once("error", (error) => { clearTimeout(timeout); reject(error); });
    child.once("exit", (exitCode) => { clearTimeout(timeout); resolve({ timedOut: false, code: exitCode }); });
  });
  assert.match(stdout, /RESULT_PRINTED/);
  assert.equal(result.timedOut, false, "child printed a result but did not terminate");
  assert.equal(result.code, 0, stderr);
}

test("successful link GET releases its streaming body and exits after printing a result", async () => {
  await withStreamingServer(async (base) => {
    const moduleUrl = new URL("./http.mjs", import.meta.url).href;
    await runChildAndRequireExit(`
      import { withSafeGet } from ${JSON.stringify(moduleUrl)};
      await withSafeGet(${JSON.stringify(`${base}/good`)}, (response) => {
        if (response.status !== 200) throw new Error("status_invalid");
      });
      console.log("RESULT_PRINTED");
    `);
  });
});

test("failed link GET also releases its streaming body and exits after printing a result", async () => {
  await withStreamingServer(async (base) => {
    const moduleUrl = new URL("./http.mjs", import.meta.url).href;
    await runChildAndRequireExit(`
      import { withSafeGet } from ${JSON.stringify(moduleUrl)};
      await assertRejects();
      async function assertRejects() {
        try {
          await withSafeGet(${JSON.stringify(`${base}/bad`)}, (response) => {
            if (response.status !== 200) throw new Error("status_invalid");
          });
          throw new Error("expected_failure_missing");
        } catch (error) {
          if (error.message !== "status_invalid") throw error;
        }
      }
      console.log("RESULT_PRINTED");
    `);
  });
});

test("HTTP timeout remains active while an asset body is still streaming", async () => {
  await withStreamingServer(async (base) => {
    await assert.rejects(
      withSafeGet(`${base}/asset`, (response) => response.arrayBuffer(), { timeoutMs: 150 }),
      (error) => error.name === "AbortError",
    );
  });
});
