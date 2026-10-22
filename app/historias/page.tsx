import type { Metadata } from "next";
import Link from "next/link";
import V2InteriorShell from "@/components/redesign-v2/site/V2InteriorShell";
import { redesignV2DisplayPilot } from "@/components/redesign-v2/redesign-v2-fonts";
import { storyCollectionLabels, storyTypeLabels } from "@/components/redesign-v2/stories/story-presentation";
import styles from "@/components/redesign-v2/stories/StoryPublic.module.css";
import { listPublicStories } from "@/lib/stories/story-public.server";
import { SITE_URL } from "@/lib/seo";
import { publicStoryImageProps, STORY_INDEX_IMAGE_SIZES } from "@/lib/stories/story-responsive-images";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Historias", description: "Crónicas, reportajes y conversaciones para vivir el motor desde dentro.",
  alternates: { canonical: `${SITE_URL}/historias` }, robots: { index: true, follow: true },
};

export default async function StoriesPage() {
  const stories = await listPublicStories();
  return <div className={`${styles.scope} ${redesignV2DisplayPilot.variable}`}>
    <V2InteriorShell navigationMode="public" title="Historias" eyebrow="EventoMotor"
      description="Crónicas, reportajes y conversaciones para vivir el motor desde dentro."
      breadcrumbs={[{ label: "Inicio", navigationId: "home" }, { label: "Historias" }]}>
      <div className={styles.list}>
        {stories.map((story) => {
          const hero = story.media[story.heroMediaId];
          return <article className={styles.card} key={story.slug}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hero.resolvedUrl} width={hero.width} height={hero.height} alt={hero.altText}
              {...publicStoryImageProps(hero.publicImage, STORY_INDEX_IMAGE_SIZES)} />
            <div>
              <span className={styles.eyebrow}>{story.collection === "COLABORACIONES"
                ? "Contenido patrocinado" : `${storyCollectionLabels[story.collection]} · ${storyTypeLabels[story.type]}`}</span>
              <h2><Link href={`/historias/${story.slug}`}>{story.title}</Link></h2>
              <p>{story.dek}</p>
              <Link href={`/historias/${story.slug}`}>Leer la historia <span aria-hidden="true">→</span></Link>
            </div>
          </article>;
        })}
        {!stories.length ? <p>Próximamente, nuevas historias para vivir el motor desde dentro.</p> : null}
      </div>
    </V2InteriorShell>
  </div>;
}
