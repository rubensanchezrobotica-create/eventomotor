export function isUnderConstruction() {
  return process.env.NEXT_PUBLIC_UNDER_CONSTRUCTION === "true";
}
