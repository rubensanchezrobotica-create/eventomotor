import type { CSSProperties, ReactNode } from "react";
import type { StoryContentBlock, StoryInlineNode } from "@/lib/stories/story-types";
import { formatEventDetailDate } from "../event-detail/event-detail-model";
import { storyImageRatio, storyPairGeometry } from "./story-presentation";
import styles from "./StoryArticle.module.css";

export type StoryRendererMedia = {
  id: string; resolvedUrl: string; width: number; height: number;
  altText: string; caption?: string | null; credit?: string | null;
};
export type StoryRendererEvent = {
  id: string; title: string; href?: string | null;
  date?: string | null; location?: string | null;
};
type Props = {
  blocks: readonly StoryContentBlock[];
  media: Readonly<Record<string, StoryRendererMedia>>;
  events: Readonly<Record<string, StoryRendererEvent>>;
};

function InlineContent({ nodes }: { nodes: readonly StoryInlineNode[] }) {
  return nodes.map((node, index) => {
    if (node.type === "LINK") return (
      <a href={node.href} key={`${node.href}-${index}`} rel="noopener noreferrer"><InlineContent nodes={node.children} /></a>
    );
    let content: ReactNode = node.text;
    if (node.marks?.includes("italic")) content = <em>{content}</em>;
    if (node.marks?.includes("bold")) content = <strong>{content}</strong>;
    return <span key={index}>{content}</span>;
  });
}

export function StoryImage({ item, kind = "single", blockId }: {
  item: StoryRendererMedia | undefined; kind?: "single" | "pair" | "hero"; blockId?: string;
}) {
  if (!item) return <p className={styles.unavailable} data-story-block-id={blockId}>Imagen no disponible.</p>;
  const ratio = storyImageRatio(item);
  const orientation = ratio === null ? "unknown" : ratio < 1 ? "portrait" : "landscape";
  return (
    <figure className={`${styles.figure} ${styles[kind === "pair" ? "figure" : kind]} ${ratio === null ? styles.unknown : ""}`}
      data-story-block-id={blockId} data-story-media-id={item.id} data-story-orientation={orientation}
      style={ratio === null ? undefined : { "--story-ratio": ratio } as CSSProperties}>
      {/* Signed private images must bypass Next's persistent image cache. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={item.altText} height={ratio === null ? undefined : item.height}
        src={item.resolvedUrl} width={ratio === null ? undefined : item.width} />
      {(item.caption || item.credit) ? (
        <figcaption className={styles.caption}>{item.caption}
          {item.credit ? <span className={styles.photoCredit}>Fotografía: {item.credit}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

export default function StoryRenderer({ blocks, media, events }: Props) {
  const firstParagraphId = blocks.find((block) => block.type === "PARAGRAPH")?.id;
  return (
    <div className={styles.body} data-story-body>
      {blocks.map((block) => {
        switch (block.type) {
          case "PARAGRAPH":
            return <p className={`${styles.paragraph} ${block.id === firstParagraphId ? styles.lead : ""}`} data-story-block-id={block.id} key={block.id}><InlineContent nodes={block.content} /></p>;
          case "HEADING":
            return block.level === 2
              ? <h2 className={styles.heading} data-story-block-id={block.id} key={block.id}>{block.text}</h2>
              : <h3 className={styles.heading} data-story-block-id={block.id} key={block.id}>{block.text}</h3>;
          case "PULL_QUOTE":
            return <blockquote className={styles.quote} data-story-block-id={block.id} key={block.id}><p>{block.text}</p>{block.attribution ? <cite>{block.attribution}</cite> : null}</blockquote>;
          case "IMAGE":
            return <StoryImage blockId={block.id} item={media[block.mediaId]} key={block.id} />;
          case "IMAGE_PAIR": {
            const geometry = storyPairGeometry(block.mediaIds.map((id) => media[id]));
            return (
              <div className={geometry ? styles.pair : styles.stackedPair} data-story-block-id={block.id} key={block.id}
                style={geometry ? { "--story-pair-columns": geometry.columns, "--story-pair-sum": geometry.sum } as CSSProperties : undefined}>
                {block.mediaIds.map((id) => <StoryImage item={media[id]} key={id} kind={geometry ? "pair" : "single"} />)}
              </div>
            );
          }
          case "GALLERY":
            return <div className={styles.gallery} data-story-block-id={block.id} key={block.id}>{block.mediaIds.map((id) => <StoryImage item={media[id]} key={id} />)}</div>;
          case "EVENT_REFERENCE": {
            const event = events[block.eventId];
            const date = formatEventDetailDate(event?.date, null);
            return (
              <aside className={styles.event} data-story-block-id={block.id} key={block.id}>
                <p className={styles.eyebrow}>Evento relacionado</p>
                {event ? <>
                  <h2>{event.title}</h2>
                  {(date || event.location) ? <p>{[date?.label, event.location].filter(Boolean).join(" · ")}</p> : null}
                  {event.href ? <a href={event.href}>Ver evento <span aria-hidden="true">→</span></a> : null}
                </> : <h2>Evento no disponible</h2>}
              </aside>
            );
          }
          default: { const exhaustive: never = block; return exhaustive; }
        }
      })}
    </div>
  );
}
