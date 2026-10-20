import type { Metadata, MetadataRoute } from "next";
import { SITE_URL, SITE_NAME, LOGO_URL } from "@/lib/seo";
import type { PublicStory } from "./story-public.server";

export function publicStoryUrl(slug: string, collection?: string) { return `${SITE_URL}/${collection === "COLABORACIONES" ? "colaboraciones" : "historias"}/${slug}`; }

export function buildStoryMetadata(story: PublicStory): Metadata {
  const hero = story.media[story.heroMediaId];
  const authors = [...new Set(story.credits.filter((credit) => credit.role === "TEXT").map((credit) => story.people[credit.personId]))];
  return {
    title: { absolute: story.seoTitle }, description: story.seoDescription,
    alternates: { canonical: publicStoryUrl(story.slug, story.collection) }, robots: { index: true, follow: true },
    authors: authors.map((name) => ({ name })),
    openGraph: { type: "article", locale: "es_ES", siteName: SITE_NAME, title: story.seoTitle,
      description: story.seoDescription, url: publicStoryUrl(story.slug, story.collection), publishedTime: story.publishedAt,
      modifiedTime: story.updatedAt, authors, images: [{ url: hero.resolvedUrl, width: hero.width, height: hero.height, alt: hero.altText }] },
    twitter: { card: "summary_large_image", title: story.seoTitle, description: story.seoDescription, images: [hero.resolvedUrl] },
  };
}

export function buildStoryJsonLd(story: PublicStory) {
  return {
    "@context": "https://schema.org", "@type": "Article", "@id": `${publicStoryUrl(story.slug, story.collection)}#article`,
    mainEntityOfPage: publicStoryUrl(story.slug, story.collection), url: publicStoryUrl(story.slug, story.collection), headline: story.title,
    ...(story.sponsor ? { sponsor: { "@type": "Organization", name: story.sponsor.name } } : {}),
    description: story.seoDescription, inLanguage: "es", datePublished: story.publishedAt, dateModified: story.updatedAt,
    image: [story.media[story.heroMediaId].resolvedUrl],
    author: [...new Set(story.credits.filter((credit) => credit.role === "TEXT").map((credit) => story.people[credit.personId]))]
      .map((name) => ({ "@type": "Person", name })),
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}${LOGO_URL}` } },
  };
}

export function buildStoriesSitemap(stories: readonly PublicStory[]): MetadataRoute.Sitemap {
  return stories.map((story) => ({ url: publicStoryUrl(story.slug, story.collection), lastModified: new Date(story.updatedAt),
    changeFrequency: "monthly", priority: .7, images: [story.media[story.heroMediaId].resolvedUrl] }));
}

export function serializeStoryJsonLd(value: ReturnType<typeof buildStoryJsonLd>) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
