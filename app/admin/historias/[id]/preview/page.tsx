import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import StoryRenderer from "@/components/redesign-v2/stories/StoryRenderer";
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
  const peopleById = new Map(bundle.people.map((person) => [person.id, person.display_name]));
  const credits = bundle.credits.map((credit) => `${peopleById.get(credit.person_id) ?? "Persona no disponible"} · ${credit.role}`);

  return (
    <article className={styles.stack}>
      <div className={styles.actions}>
        <p className={styles.eyebrow}>Preview privada · noindex · no-store</p>
        <Link className={styles.secondary} href={`/admin/historias/${id}`}>Volver al editor</Link>
      </div>
      {bundle.story.hero_media_id && media[bundle.story.hero_media_id] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={media[bundle.story.hero_media_id].altText}
          height={media[bundle.story.hero_media_id].height}
          src={media[bundle.story.hero_media_id].resolvedUrl}
          style={{ width: "100%", height: "auto", borderRadius: 12 }}
          width={media[bundle.story.hero_media_id].width}
        />
      ) : null}
      <header>
        <p className={styles.eyebrow}>{bundle.story.type} · {bundle.story.collection}</p>
        <h1>{bundle.story.title || "Historia sin título"}</h1>
        {bundle.story.dek ? <p className={styles.lede}>{bundle.story.dek}</p> : null}
        {bundle.story.context_location ? <p>{bundle.story.context_location}</p> : null}
        {credits.length ? <p className={styles.muted}>{credits.join(" · ")}</p> : null}
      </header>
      <StoryRenderer blocks={bundle.story.content_blocks} events={events} media={media} />
    </article>
  );
}
