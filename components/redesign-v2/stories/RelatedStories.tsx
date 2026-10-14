import Link from "next/link";
import type { StoryCollection } from "@/lib/stories/story-types";
import { storyCollectionLabels } from "./story-presentation";
import styles from "./StoryPublic.module.css";

export default function RelatedStories({ stories, eventTitle }: { stories: readonly { slug: string; title: string; collection: StoryCollection }[]; eventTitle: string }) {
  if (!stories.length) return null;
  return <section aria-label="Historias de este evento" data-related-stories>
    {stories.map((story) => <article className={styles.related} key={story.slug}>
      <p className={styles.eyebrow}>{storyCollectionLabels[story.collection]} · EventoMotor</p>
      <h2>{story.title}</h2>
      <Link href={`/historias/${story.slug}`}>Leer nuestra crónica de {eventTitle} <span aria-hidden="true">→</span></Link>
    </article>)}
  </section>;
}
