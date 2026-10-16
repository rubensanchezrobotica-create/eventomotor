/** Public, preverified delivery attributes only; private previews never receive these. */
export type StoryPublicImage = { src: string; srcSet?: string };

/** Sizes mirror the existing CSS caps, not a new layout. Conservative at short heights. */
export function storyArticleImageSizes(kind: "hero" | "single" | "pair", ratio: number) {
  if (kind === "hero") return "(max-width: 600px) calc(100vw - 40px), (max-width: 850px) 660px, 614px";
  const cap = kind === "pair" ? 520 : 600;
  const width = Math.min(960, Math.round(cap * ratio), kind === "single" && ratio < 1 ? 520 : 960);
  return `(max-width: 600px) calc(100vw - 40px), ${width}px`;
}

export const STORY_INDEX_IMAGE_SIZES = "(max-width: 600px) calc(100vw - 32px), (max-width: 1208px) 50vw, 540px";
export const STORY_HOME_IMAGE_SIZES = "(max-width: 350px) calc(100vw - 24px), (max-width: 760px) calc(100vw - 32px), 660px";

export function publicStoryImageProps(image: StoryPublicImage | undefined, sizes: string, priority = false) {
  // Absence preserves the private renderer's exact original URL and attributes.
  if (!image) return {};
  return {
    src: image.src,
    srcSet: image.srcSet,
    sizes: image.srcSet ? sizes : undefined,
    loading: priority ? "eager" as const : "lazy" as const,
    fetchPriority: priority ? "high" as const : "auto" as const,
    decoding: "async" as const,
  };
}
