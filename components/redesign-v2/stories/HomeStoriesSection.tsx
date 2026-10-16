import Link from "next/link";
import { listHomeStories, type HomeStory } from "@/lib/stories/story-home.server";
import { publicStoryImageProps, STORY_HOME_IMAGE_SIZES } from "@/lib/stories/story-responsive-images";
import styles from "./HomeStoriesSection.module.css";

export function HomeStoriesContent({ stories }: { stories: readonly HomeStory[] }) {
  const [featured, ...more] = stories;
  if (!featured) return null;
  return (
    <section className={styles.section} aria-labelledby="home-stories-title" data-home-stories>
      <div className={styles.shell}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Historias <span aria-hidden="true">·</span> Desde dentro</p>
          <Link className={styles.indexLink} href="/historias" prefetch={false}>Todas las historias <span aria-hidden="true">↗</span></Link>
        </div>
        <article className={styles.feature}>
          <Link className={styles.media} href={`/historias/${featured.slug}`} prefetch={false} tabIndex={-1} aria-hidden="true">
            {/* Preverified CDN variants; no request-time transform. Layout and decorative alt stay unchanged. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={featured.hero.src} alt="" width={featured.hero.width} height={featured.hero.height}
              className={styles.image} {...publicStoryImageProps(featured.hero.publicImage, STORY_HOME_IMAGE_SIZES)} />
          </Link>
          <div className={styles.copy}>
            <h2 id="home-stories-title"><Link href={`/historias/${featured.slug}`} prefetch={false}>{featured.title}</Link></h2>
            <p className={styles.summary}>{featured.summary}</p>
            <Link className={styles.readLink} href={`/historias/${featured.slug}`} prefetch={false}>Leer historia <span aria-hidden="true">→</span></Link>
          </div>
        </article>
        {more.length ? <div className={styles.more} aria-label="Más historias publicadas">
          {more.map((story) => <Link href={`/historias/${story.slug}`} prefetch={false} key={story.slug}>{story.title} <span aria-hidden="true">↗</span></Link>)}
        </div> : null}
      </div>
    </section>
  );
}

export default async function HomeStoriesSection() {
  return <HomeStoriesContent stories={await listHomeStories()} />;
}
