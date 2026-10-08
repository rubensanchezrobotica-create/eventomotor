import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import StoryArticle from "@/components/redesign-v2/stories/StoryArticle";
import { redesignV2DisplayPilot } from "@/components/redesign-v2/redesign-v2-fonts";
import styles from "@/components/admin/stories/StoryAdmin.module.css";
import {
  getStoryForAdmin,
  resolveStoryMediaForAdmin,
} from "@/lib/stories/story-admin.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Preview privada de Historia | EventoMotor",
  robots: { index: false, follow: false, nocache: true },
};

export default async function StoryPrivatePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await getStoryForAdmin(id);
  if (!bundle) notFound();
  const resolvedMedia = await resolveStoryMediaForAdmin(id, bundle.media);
  const media = Object.fromEntries(resolvedMedia.map((item) => [item.id, {
    id: item.id,
    resolvedUrl: item.resolvedUrl,
    width: item.width,
    height: item.height,
    altText: item.alt_text,
    caption: item.caption,
    credit: item.credit,
  }]));
  const events = Object.fromEntries(bundle.relatedEvents.map((event) => [event.id, {
    id: event.id,
    title: event.title,
    href: event.slug ? `/evento/${event.slug}` : null,
    date: event.start_date,
    location: [event.venue, event.city, event.province].filter(Boolean).join(", "),
  }]));
  const people = Object.fromEntries(bundle.people.map((person) => [person.id, person.display_name]));
  const credits = bundle.credits.map((credit) => ({
    personId: credit.person_id, role: credit.role, sortOrder: credit.sort_order,
  }));

  return (
    <div className={redesignV2DisplayPilot.variable}>
      <div className={styles.actions}>
        <p className={styles.eyebrow}>Preview privada · noindex · no-store</p>
        <Link className={styles.secondary} href={`/admin/historias/${id}`}>Volver al editor</Link>
      </div>
      <StoryArticle
        title={bundle.story.title} dek={bundle.story.dek} type={bundle.story.type}
        collection={bundle.story.collection} contextLocation={bundle.story.context_location}
        heroMediaId={bundle.story.hero_media_id} blocks={bundle.story.content_blocks}
        events={events} media={media} credits={credits} people={people}
      />
    </div>
  );
}
