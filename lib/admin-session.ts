import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const ADMIN_SESSION_COOKIE = "eventomotor_admin_session";
export const ADMIN_MEDIA_SESSION_COOKIE = "eventomotor_admin_media_session";
export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;

const TOKEN_VERSION = 1 as const;
const SIGNING_CONTEXT = "eventomotor:admin-session:v1";

type AdminSessionPayload = {
  v: typeof TOKEN_VERSION;
  iat: number;
  exp: number;
  nonce: string;
};

export class AdminSessionError extends Error {
  constructor(message = "Sesión administrativa no válida.") {
    super(message);
    this.name = "AdminSessionError";
  }
}

function fixedDigest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

function signingKey(secret: string) {
  return createHmac("sha256", secret).update(SIGNING_CONTEXT).digest();
}

function signature(encodedPayload: string, secret: string) {
  return createHmac("sha256", signingKey(secret))
    .update(encodedPayload, "ascii")
    .digest("base64url");
}

export function verifyAdminCredential(candidate: string, secret: string) {
  if (!candidate || candidate.length > 4_096 || !secret) return false;
  return timingSafeEqual(fixedDigest(candidate), fixedDigest(secret));
}

export function createAdminSessionToken(
  secret: string,
  nowMs = Date.now(),
  nonce = randomBytes(18).toString("base64url"),
) {
  const issuedAt = Math.floor(nowMs / 1_000);
  const payload: AdminSessionPayload = {
    v: TOKEN_VERSION,
    iat: issuedAt,
    exp: issuedAt + ADMIN_SESSION_TTL_SECONDS,
    nonce,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifyAdminSessionToken(
  token: string | null | undefined,
  secret: string,
  nowMs = Date.now(),
) {
  if (!token || !secret || token.length > 2_048) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const expected = signature(parts[0], secret);
  const supplied = parts[1];
  if (expected.length !== supplied.length) return false;
  if (!timingSafeEqual(Buffer.from(expected, "ascii"), Buffer.from(supplied, "ascii"))) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf8"),
    ) as Partial<AdminSessionPayload>;
    if (
      payload.v !== TOKEN_VERSION
      || typeof payload.iat !== "number"
      || typeof payload.exp !== "number"
      || !Number.isInteger(payload.iat)
      || !Number.isInteger(payload.exp)
      || typeof payload.nonce !== "string"
      || !/^[A-Za-z0-9_-]{16,128}$/.test(payload.nonce)
    ) return false;
    const now = Math.floor(nowMs / 1_000);
    return payload.exp === payload.iat + ADMIN_SESSION_TTL_SECONDS
      && payload.iat <= now + 30
      && payload.exp > now;
  } catch {
    return false;
  }
}

export function adminSessionCookieOptions(nodeEnv = process.env.NODE_ENV) {
  return {
    httpOnly: true,
    secure: nodeEnv === "production",
    sameSite: "strict" as const,
    path: "/admin",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  };
}

export function adminMediaApiSessionCookieOptions(nodeEnv = process.env.NODE_ENV) {
  return {
    ...adminSessionCookieOptions(nodeEnv),
    path: "/api/admin/stories/media",
  };
}

export function adminSessionClearCookieOptions(nodeEnv = process.env.NODE_ENV) {
  return {
    ...adminSessionCookieOptions(nodeEnv),
    maxAge: 0,
    expires: new Date(0),
  };
}

export function adminMediaApiSessionClearCookieOptions(nodeEnv = process.env.NODE_ENV) {
  return {
    ...adminMediaApiSessionCookieOptions(nodeEnv),
    maxAge: 0,
    expires: new Date(0),
  };
}

export type AdminSessionCookieOptions =
  | ReturnType<typeof adminSessionCookieOptions>
  | ReturnType<typeof adminMediaApiSessionCookieOptions>
  | ReturnType<typeof adminSessionClearCookieOptions>
  | ReturnType<typeof adminMediaApiSessionClearCookieOptions>;

export type AdminSessionCookieWriter = (
  name: string,
  value: string,
  options: AdminSessionCookieOptions,
) => void;

export type AdminSessionCookieReader = (
  name: string,
) => { value: string } | undefined;

export function writeAdminSessionCookies(
  write: AdminSessionCookieWriter,
  token: string,
  nodeEnv = process.env.NODE_ENV,
) {
  write(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions(nodeEnv));
  write(
    ADMIN_MEDIA_SESSION_COOKIE,
    token,
    adminMediaApiSessionCookieOptions(nodeEnv),
  );
}

export function clearAdminSessionCookies(
  write: AdminSessionCookieWriter,
  nodeEnv = process.env.NODE_ENV,
) {
  write(ADMIN_SESSION_COOKIE, "", adminSessionClearCookieOptions(nodeEnv));
  write(
    ADMIN_MEDIA_SESSION_COOKIE,
    "",
    adminMediaApiSessionClearCookieOptions(nodeEnv),
  );
}

export function readAdminPageSessionToken(read: AdminSessionCookieReader) {
  return read(ADMIN_SESSION_COOKIE)?.value;
}

export function readAdminMediaSessionToken(read: AdminSessionCookieReader) {
  return read(ADMIN_MEDIA_SESSION_COOKIE)?.value;
}

export function assertValidAdminSessionToken(
  token: string | null | undefined,
  secret: string,
  nowMs = Date.now(),
) {
  if (!verifyAdminSessionToken(token, secret, nowMs)) {
    throw new AdminSessionError();
  }
  return { authenticated: true as const };
}

export function safeAdminNext(value: string | null | undefined) {
  if (
    typeof value !== "string"
    || !value
    || value.startsWith("//")
    || value.includes("\\")
    || /%(?:2f|5c)/i.test(value)
    || /[\r\n]/.test(value)
  ) {
    return "/admin/historias";
  }
  try {
    const url = new URL(value, "https://eventomotor.invalid");
    if (
      url.origin !== "https://eventomotor.invalid"
      || !(url.pathname === "/admin" || url.pathname.startsWith("/admin/"))
    ) {
      return "/admin/historias";
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/admin/historias";
  }
}

export function isTrustedAdminMutationOrigin(
  origin: string | null,
  host: string | null,
) {
  if (!origin || !host) return false;
  try {
    const originUrl = new URL(origin);
    const expectedHost = host.split(",", 1)[0]?.trim().toLowerCase();
    return Boolean(expectedHost)
      && originUrl.host.toLowerCase() === expectedHost
      && (originUrl.protocol === "https:" || originUrl.protocol === "http:");
  } catch {
    return false;
  }
}
