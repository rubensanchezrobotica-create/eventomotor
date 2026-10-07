import "server-only";

import { cookies, headers } from "next/headers";
import {
  AdminSessionError,
  assertValidAdminSessionToken,
  clearAdminSessionCookies,
  createAdminSessionToken,
  isTrustedAdminMutationOrigin,
  readAdminMediaSessionToken,
  readAdminPageSessionToken,
  safeAdminNext,
  type AdminSessionCookieWriter,
  verifyAdminCredential,
  writeAdminSessionCookies,
} from "./admin-session";

export {
  ADMIN_MEDIA_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  AdminSessionError,
  adminMediaApiSessionClearCookieOptions,
  adminMediaApiSessionCookieOptions,
  adminSessionClearCookieOptions,
  adminSessionCookieOptions,
  assertValidAdminSessionToken,
  clearAdminSessionCookies,
  createAdminSessionToken,
  isTrustedAdminMutationOrigin,
  readAdminMediaSessionToken,
  readAdminPageSessionToken,
  safeAdminNext,
  verifyAdminCredential,
  verifyAdminSessionToken,
  writeAdminSessionCookies,
} from "./admin-session";

function configuredAdminSecret() {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new AdminSessionError("La administración no está configurada.");
  return secret;
}

export type AdminSessionRuntime = {
  readSessionToken(): Promise<string | undefined>;
  redirectToLogin(location: string): Promise<never>;
};

export type AdminMutationRuntime = AdminSessionRuntime & {
  readMutationOrigin(): Promise<{ origin: string | null; host: string | null }>;
};

const defaultAdminSessionRuntime: AdminSessionRuntime = {
  async readSessionToken() {
    const cookieStore = await cookies();
    return readAdminPageSessionToken((name) => cookieStore.get(name));
  },
  async redirectToLogin(location) {
    const { redirect } = await import("next/navigation");
    return redirect(location);
  },
};

const defaultAdminMediaSessionRuntime: AdminSessionRuntime = {
  async readSessionToken() {
    const cookieStore = await cookies();
    return readAdminMediaSessionToken((name) => cookieStore.get(name));
  },
  async redirectToLogin(location) {
    const { redirect } = await import("next/navigation");
    return redirect(location);
  },
};

const defaultAdminMutationRuntime: AdminMutationRuntime = {
  ...defaultAdminSessionRuntime,
  async readMutationOrigin() {
    const requestHeaders = await headers();
    return {
      origin: requestHeaders.get("origin"),
      host: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    };
  },
};

export async function assertTrustedAdminMutation(
  runtime: Pick<AdminMutationRuntime, "readMutationOrigin"> = defaultAdminMutationRuntime,
) {
  const { origin, host } = await runtime.readMutationOrigin();
  if (!isTrustedAdminMutationOrigin(origin, host)) {
    throw new AdminSessionError("Origen administrativo no permitido.");
  }
}

export async function requireTrustedAdminMutation(
  nextPath: string,
  runtime: AdminMutationRuntime = defaultAdminMutationRuntime,
) {
  await requireAdminSession(nextPath, runtime);
  await assertTrustedAdminMutation(runtime);
  return { authenticated: true as const, trustedOrigin: true as const };
}

export async function createAdminSession(writeCookie?: AdminSessionCookieWriter) {
  const secret = configuredAdminSecret();
  const cookieStore = writeCookie ? null : await cookies();
  const write = writeCookie
    ?? ((name, value, options) => cookieStore!.set(name, value, options));
  const token = createAdminSessionToken(secret);
  writeAdminSessionCookies(write, token);
}

export async function clearAdminSession(writeCookie?: AdminSessionCookieWriter) {
  const cookieStore = writeCookie ? null : await cookies();
  const write = writeCookie
    ?? ((name, value, options) => cookieStore!.set(name, value, options));
  clearAdminSessionCookies(write);
}

export async function verifyAdminSession(
  runtime: AdminSessionRuntime = defaultAdminSessionRuntime,
) {
  const token = await runtime.readSessionToken();
  try {
    assertValidAdminSessionToken(token, configuredAdminSecret());
    return true;
  } catch {
    return false;
  }
}

export async function verifyAdminMediaSession(
  runtime: AdminSessionRuntime = defaultAdminMediaSessionRuntime,
) {
  const token = await runtime.readSessionToken();
  try {
    assertValidAdminSessionToken(token, configuredAdminSecret());
    return true;
  } catch {
    return false;
  }
}

export async function requireAdminSession(
  nextPath = "/admin/historias",
  runtime: AdminSessionRuntime = defaultAdminSessionRuntime,
) {
  if (!(await verifyAdminSession(runtime))) {
    await runtime.redirectToLogin(
      `/admin/login?next=${encodeURIComponent(safeAdminNext(nextPath))}`,
    );
  }
  return { authenticated: true as const };
}

export function verifyConfiguredAdminCredential(candidate: string) {
  try {
    return verifyAdminCredential(candidate, configuredAdminSecret());
  } catch {
    return false;
  }
}
