import "server-only";

const SCRIPT_PATTERN = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;
const HEAD_PATTERN = /<head\b[^>]*>/i;
const LINK_PATTERN = /\bhref=(?:"([^"]+)"|'([^']+)')/gi;
const MAILBOX_CONTENT_SECURITY_POLICY =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

export function buildSafeNewsletterMailboxSrcDoc(html: string): string {
  const withoutScripts = html.replace(SCRIPT_PATTERN, "");
  const policy = `<meta http-equiv="Content-Security-Policy" content="${MAILBOX_CONTENT_SECURITY_POLICY}">`;
  if (HEAD_PATTERN.test(withoutScripts)) {
    return withoutScripts.replace(HEAD_PATTERN, (head) => `${head}${policy}`);
  }
  return `<!doctype html><html><head>${policy}</head><body>${withoutScripts}</body></html>`;
}

export function listRedactedNewsletterCaptureLinks(
  html: string,
  allowedOrigin: string,
): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(LINK_PATTERN)) {
    const value = match[1] ?? match[2];
    if (!value) continue;
    try {
      const parsed = new URL(value, allowedOrigin);
      if (parsed.origin !== allowedOrigin) {
        links.add("[origen externo bloqueado]");
        continue;
      }
      const parameterNames = [...parsed.searchParams.keys()];
      const query = parameterNames.length
        ? `?${parameterNames.map((name) => `${name}=[oculto]`).join("&")}`
        : "";
      links.add(`${parsed.pathname}${query}`);
    } catch {
      links.add("[enlace no válido]");
    }
  }
  return [...links];
}
