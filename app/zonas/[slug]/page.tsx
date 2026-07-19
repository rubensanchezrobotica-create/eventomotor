import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ZonePreviewPage from "@/components/zones/ZonePreviewPage";
import {
  buildZonePreviewData,
  isZonePreviewId,
  parseZoneFilters,
} from "@/components/zones/zone-preview-model";
import { getVisibleEvents } from "@/lib/public-events";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/seo";
import { SEO_ZONES } from "@/lib/seo-taxonomy";

type ZonePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return SEO_ZONES.map((zone) => ({ slug: zone.slug }));
}

function findZone(slug: string) {
  return SEO_ZONES.find((zone) => zone.slug === slug);
}

export async function generateMetadata({ params }: ZonePageProps): Promise<Metadata> {
  const { slug } = await params;
  const zone = findZone(slug);

  if (!zone) return {};

  const canonical = `${SITE_URL}/zonas/${zone.slug}`;
  const image = absoluteUrl(DEFAULT_OG_IMAGE);

  return {
    title: zone.metaTitle,
    description: zone.metaDescription,
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical,
    },
    openGraph: {
      title: zone.metaTitle,
      description: zone.metaDescription,
      url: canonical,
      siteName: "EventoMotor",
      locale: "es_ES",
      type: "website",
      images: [
        {
          url: image,
          width: 1024,
          height: 1024,
          alt: "EventoMotor",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: zone.metaTitle,
      description: zone.metaDescription,
      images: [image],
    },
  };
}

export default async function ZonePage({ params, searchParams }: ZonePageProps) {
  const { slug } = await params;
  if (!isZonePreviewId(slug)) notFound();

  const [filtersParams, events] = await Promise.all([
    searchParams,
    getVisibleEvents(),
  ]);
  const now = new Date();
  const data = buildZonePreviewData(events, slug, now);
  const initialFilters = parseZoneFilters(filtersParams);

  return (
    <ZonePreviewPage
      data={data}
      initialFilters={initialFilters}
      mode="public"
      nowIso={now.toISOString()}
      pathname={`/zonas/${slug}`}
    />
  );
}
