import { legacyRedirect } from "@/lib/legacy-redirects";

// Redirección legacy de cuenta WordPress.
export function GET(request: Request) {
  return legacyRedirect(request, "/");
}

export const HEAD = GET;
