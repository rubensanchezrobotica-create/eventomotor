import Link from "next/link";
import {
  getLatestHomeSponsoredStory,
  type HomeSponsoredStory,
} from "@/lib/stories/story-home.server";
import {
  publicStoryImageProps,
  STORY_HOME_IMAGE_SIZES,
} from "@/lib/stories/story-responsive-images";
import styles from "./HomeSponsoredStorySection.module.css";

export function HomeSponsoredStoryContent({ story }: { story: HomeSponsoredStory | null }) {
  if (!story) return null;
  const href = `/historias/${story.slug}`;

  return (
    <section
      aria-labelledby="home-sponsored-story-title"
      className={styles.section}
      data-home-sponsored-story
    >
      <div className={styles.shell}>
        <article className={styles.card}>
          <Link
            aria-hidden="true"
            className={styles.media}
            href={href}
            prefetch={false}
            tabIndex={-1}
          >
            {/* Preverified CDN variants; no request-time transform. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              className={styles.image}
              height={story.hero.height}
              src={story.hero.src}
              width={story.hero.width}
              {...publicStoryImageProps(story.hero.publicImage, STORY_HOME_IMAGE_SIZES)}
            />
          </Link>
          <div className={styles.copy}>
            <p className={styles.disclosure}>{story.label}</p>
            <h2 id="home-sponsored-story-title">
              <Link href={href} prefetch={false}>{story.title}</Link>
            </h2>
            <p className={styles.summary}>{story.summary}</p>
            <Link className={styles.readLink} href={href} prefetch={false}>
              Leer contenido <span aria-hidden="true">→</span>
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}

export default async function HomeSponsoredStorySection() {
  return <HomeSponsoredStoryContent story={await getLatestHomeSponsoredStory()} />;
}
