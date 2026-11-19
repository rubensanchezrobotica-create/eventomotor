// Keep the abort timer active until the response body has been read or closed.
export async function withSafeGet(url, inspect, { timeoutMs = 20_000 } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20_000) {
    throw new Error("http_timeout_invalid");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(url, { redirect: "manual", signal: controller.signal });
    return await inspect(response);
  } finally {
    try {
      if (response?.body && !response.bodyUsed) await response.body.cancel();
    } finally {
      clearTimeout(timeout);
    }
  }
}
