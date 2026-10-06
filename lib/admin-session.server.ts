import "server-only";

import { cookies, headers } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  AdminSessionError,
  adminSessionClearCookieOptions,
  adminSessionCookieOptions,
  assertValidAdminSessionToken,
  createAdminSessionToken,
  isTrustedAdminMutationOrigin,
  safeAdminNext,
  verifyAdminCredential,
} from "./admin-session";

export {
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
    return (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
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

export async function createAdminSession() {
  const secret = configuredAdminSecret();
  const cookieStore = await cookies();
  cookieStore.set(
    ADMIN_SESSION_COOKIE,
    createAdminSessionToken(secret),
    adminSessionCookieOptions(),
  );
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, "", adminSessionClearCookieOptions());
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
