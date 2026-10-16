import "server-only";
import registry from "./story-responsive-registry.json";
import type { StoryPublicImage } from "./story-responsive-images";

type Source = { src: string; width: number; height: number; bytes?: number };
type Registry = typeof registry;
const hash = /^[a-f0-9]{64}$/;
const uuid = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const publicPath = new RegExp(`^/storage/v1/object/public/story-media/${uuid}/${uuid}/asset\\.(?:png|jpe?g|webp)$`);
const positive = (n: number) => Number.isSafeInteger(n) && n > 0;

/** Registry is shipped with the code after CDN verification, never read from a workstation at runtime.
 * Missing, stale or invalid entries fail back to the approved public original, not guessed variants.
 * This is presentation-only: it does not promote media or change the publication contract. */
export function resolveStoryPublicImage(source: Source, verified: Registry = registry): StoryPublicImage | undefined {
  let url: URL;
  try { url = new URL(source.src); } catch { return undefined; }
  if (url.protocol !== "https:" || !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname)
    || url.port || url.username || url.password || url.search || url.hash || !publicPath.test(url.pathname)
    || url.href !== source.src || !positive(source.width) || !positive(source.height)
    || Math.max(source.width, source.height) > 3200) return undefined;
  const fallback = { src: source.src };
  if (verified.version !== 1 || verified.profile !== "responsive-v1-q90") return fallback;
  const matches = verified.images.filter((image) => image.source === source.src);
  if (matches.length !== 1) return fallback;
  const entry = matches[0];
  if (entry.width !== source.width || entry.height !== source.height || !hash.test(entry.sha256)
    || !positive(entry.bytes) || (source.bytes !== undefined && source.bytes !== entry.bytes)
    || entry.variants.length < 2 || entry.variants.at(-1)?.width !== source.width) return fallback;
  let previous = 0;
  for (const variant of entry.variants) {
    if (!positive(variant.width) || !positive(variant.height) || !positive(variant.bytes) || !hash.test(variant.sha256)
      || variant.width <= previous || variant.width > source.width
      || variant.height !== Math.round(source.height * variant.width / source.width)) return fallback;
    previous = variant.width;
  }
  const prefix = source.src.slice(0, source.src.lastIndexOf("/") + 1);
  const candidates = entry.variants.map((variant) => `${prefix}${verified.profile}-w${variant.width}.webp ${variant.width}w`);
  return { src: candidates.at(-1)!.split(" ")[0], srcSet: candidates.join(", ") };
}
