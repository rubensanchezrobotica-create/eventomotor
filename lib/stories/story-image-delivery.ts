// Only stable, already-public editorial assets may enter the shared image cache.
// Private Preview images must remain direct requests with their existing auth.
export const STORY_IMAGE_REMOTE_PATTERN = {
  protocol: "https" as const,
  hostname: "lovhbsxihpggrwnunjcz.supabase.co",
  port: "",
  pathname: "/storage/v1/object/public/story-media/**",
  search: "",
};

export function isOptimizableStoryImage(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === "https:" && url.hostname === STORY_IMAGE_REMOTE_PATTERN.hostname
      && !url.port && !url.username && !url.password && !url.search && !url.hash
      && /^\/storage\/v1\/object\/public\/story-media\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/asset\.(?:png|jpg|webp)$/.test(url.pathname);
  } catch { return false; }
}

/** Upper bounds of the existing CSS slots, not new layout dimensions. */
export function storyImageSizes(kind: "single" | "pair" | "hero", ratio: number): string {
  const mobile = "(max-width: 600px) calc(100vw - 48px)";
  if (kind === "hero") return `${mobile}, (max-width: 850px) 660px, 614px`;
  const cap = kind === "pair" ? 520 : 600;
  return `${mobile}, ${Math.min(960, Math.round(cap * ratio))}px`;
}
