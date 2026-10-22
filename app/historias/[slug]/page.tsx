import Link from "next/link";
import { notFound } from "next/navigation";
import StoryArticle from "@/components/redesign-v2/stories/StoryArticle";
import V2InteriorShell from "@/components/redesign-v2/site/V2InteriorShell";
import { redesignV2DisplayPilot } from "@/components/redesign-v2/redesign-v2-fonts";
import styles from "@/components/redesign-v2/stories/StoryPublic.module.css";
import { getPublicStory } from "@/lib/stories/story-public.server";
import { buildStoryMetadata, buildStoryJsonLd, serializeStoryJsonLd } from "@/lib/stories/story-public-seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const story = await getPublicStory((await params).slug);
  if (!story) notFound();
  return buildStoryMetadata(story);
}

export default async function PublicStoryPage({ params }: Props) {
  const story = await getPublicStory((await params).slug);
  if (!story) notFound();
  return <div className={`${styles.scope} ${redesignV2DisplayPilot.variable}`}>
    <V2InteriorShell hideHero navigationMode="public" title={story.title} eyebrow="Historias" description="" breadcrumbs={[]}>
      <div className={styles.reader}>
        <nav className={styles.breadcrumb} aria-label="Migas de pan">
          <Link href="/">Inicio</Link><span aria-hidden="true">/</span><Link href="/historias">Historias</Link>
        </nav>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStoryJsonLd(buildStoryJsonLd(story)) }} />
        <StoryArticle title={story.title} dek={story.dek} type={story.type} collection={story.collection} sponsor={story.sponsor}
          contextLocation={story.contextLocation} heroMediaId={story.heroMediaId} blocks={story.blocks}
          media={story.media} events={story.events} credits={story.credits} people={story.people} />
        <p className={styles.date}>Publicada el <time dateTime={story.publishedAt}>{new Intl.DateTimeFormat("es-ES", {
          timeZone: "Europe/Madrid", dateStyle: "long",
        }).format(new Date(story.publishedAt))}</time></p>
      </div>
    </V2InteriorShell>
  </div>;
}
