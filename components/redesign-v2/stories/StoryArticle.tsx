import type { StoryCollection, StoryContentBlock, StoryCredit, StoryType } from "@/lib/stories/story-types";
import StoryRenderer, { StoryImage, type StoryRendererEvent, type StoryRendererMedia } from "./StoryRenderer";
import { groupStoryByline, storyCollectionLabels, storyTypeLabels } from "./story-presentation";
import styles from "./StoryArticle.module.css";

type Props = {
  title: string; dek: string; type: StoryType; collection: StoryCollection;
  contextLocation?: string | null; heroMediaId: string | null;
  blocks: readonly StoryContentBlock[];
  media: Readonly<Record<string, StoryRendererMedia>>;
  events: Readonly<Record<string, StoryRendererEvent>>;
  credits: readonly StoryCredit[];
  people: Readonly<Record<string, string>>;
};

/** Presentation only: shared by the private preview and future public reader. */
export default function StoryArticle(props: Props) {
  const byline = groupStoryByline(props.credits, props.people);
  return (
    <article className={styles.article} data-story-article>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <p className={styles.eyebrow}>{storyCollectionLabels[props.collection]} · {storyTypeLabels[props.type]}</p>
          <h1 className={styles.title}>{props.title || "Historia sin título"}</h1>
          {props.dek ? <p className={styles.dek}>{props.dek}</p> : null}
          {(byline.length || props.contextLocation) ? (
            <div className={styles.byline}>
              {byline.map((person) => <p key={person.personId}><span>{person.label}:</span> <strong>{person.name}</strong></p>)}
              {props.contextLocation ? <p className={styles.context}>{props.contextLocation}</p> : null}
            </div>
          ) : null}
        </div>
        {props.heroMediaId ? <StoryImage item={props.media[props.heroMediaId]} kind="hero" /> : null}
      </header>
      <StoryRenderer blocks={props.blocks} events={props.events} media={props.media} />
    </article>
  );
}
