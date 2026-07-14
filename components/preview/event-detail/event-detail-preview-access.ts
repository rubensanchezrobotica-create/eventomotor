export function isEventDetailPreviewAvailable(vercelEnvironment: string | undefined) {
  return vercelEnvironment !== "production";
}
