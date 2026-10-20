import type { Metadata } from "next";
import Link from "next/link";
import V2InteriorShell from "@/components/redesign-v2/site/V2InteriorShell";
import { redesignV2DisplayPilot } from "@/components/redesign-v2/redesign-v2-fonts";
import styles from "@/components/redesign-v2/stories/StoryPublic.module.css";
import { listPublicCollaborations } from "@/lib/stories/story-public.server";
import { publicStoryImageProps, STORY_INDEX_IMAGE_SIZES } from "@/lib/stories/story-responsive-images";
import { SITE_URL } from "@/lib/seo";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Colaboraciones", description: "Contenido patrocinado, identificado y separado de nuestras Historias independientes.",
  alternates: { canonical: `${SITE_URL}/colaboraciones` }, robots: { index: true, follow: true } };

export default async function CollaborationsPage() {
  const stories = await listPublicCollaborations();
  return <div className={`${styles.scope} ${redesignV2DisplayPilot.variable}`}>
    <V2InteriorShell navigationMode="public" title="Colaboraciones" eyebrow="EventoMotor"
      description="Contenido patrocinado, identificado y separado de nuestras Historias independientes."
      breadcrumbs={[{ label: "Inicio", navigationId: "home" }, { label: "Colaboraciones" }]}>
      <div className={styles.list}>{stories.map((story) => {
        const hero = story.media[story.heroMediaId];
        return <article className={styles.card} key={story.slug}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero.resolvedUrl} width={hero.width} height={hero.height} alt={hero.altText}
            {...publicStoryImageProps(hero.publicImage, STORY_INDEX_IMAGE_SIZES)} />
          <div><p className={styles.eyebrow}>Contenido patrocinado</p>
            <p>Anunciante: {story.sponsor!.name}</p>
            <h2><Link href={`/colaboraciones/${story.slug}`}>{story.title}</Link></h2><p>{story.dek}</p>
            <Link href={`/colaboraciones/${story.slug}`}>Leer el artículo <span aria-hidden="true">→</span></Link>
          </div>
        </article>;
      })}{!stories.length ? <p>No hay colaboraciones publicadas.</p> : null}</div>
    </V2InteriorShell>
  </div>;
}
