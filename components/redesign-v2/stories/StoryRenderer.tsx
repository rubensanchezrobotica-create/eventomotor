import type {
  StoryContentBlock,
  StoryInlineNode,
} from "@/lib/stories/story-types";

const bodyStyle: React.CSSProperties = {
  display: "grid",
  gap: "1.4rem",
  color: "#f5f1e8",
  fontSize: "clamp(1rem, 1.8vw, 1.125rem)",
  lineHeight: 1.75,
};

const imageGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
  gap: ".8rem",
};

export type StoryRendererMedia = {
  id: string;
  resolvedUrl: string;
  width: number;
  height: number;
  altText: string;
  caption?: string | null;
  credit?: string | null;
};

export type StoryRendererEvent = {
  id: string;
  title: string;
  href?: string | null;
  date?: string | null;
  location?: string | null;
};

type Props = {
  blocks: readonly StoryContentBlock[];
  media: Readonly<Record<string, StoryRendererMedia>>;
  events: Readonly<Record<string, StoryRendererEvent>>;
};

function InlineContent({ nodes }: { nodes: readonly StoryInlineNode[] }) {
  return nodes.map((node, index) => {
    if (node.type === "LINK") {
      return (
        <a href={node.href} key={`${node.href}-${index}`} rel="noopener noreferrer">
          <InlineContent nodes={node.children} />
        </a>
      );
    }
    let content: React.ReactNode = node.text;
    if (node.marks?.includes("italic")) content = <em>{content}</em>;
    if (node.marks?.includes("bold")) content = <strong>{content}</strong>;
    return <span key={index}>{content}</span>;
  });
}

function StoryImage({ item }: { item: StoryRendererMedia | undefined }) {
  if (!item) return <p style={{ color: "#aaa" }}>Imagen no disponible en esta Preview.</p>;
  return (
    <figure style={{ margin: 0 }}>
      {/* Private signed previews must bypass Next's persistent image cache. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={item.altText}
        height={item.height}
        src={item.resolvedUrl}
        style={{ display: "block", width: "100%", height: "auto", borderRadius: 10, background: "#111" }}
        width={item.width}
      />
      {(item.caption || item.credit) ? (
        <figcaption style={{ marginTop: ".4rem", color: "#aaa", fontSize: ".78rem" }}>
          {item.caption}{item.caption && item.credit ? " · " : ""}{item.credit}
        </figcaption>
      ) : null}
    </figure>
  );
}

export default function StoryRenderer({ blocks, media, events }: Props) {
  return (
    <div style={bodyStyle}>
      {blocks.map((block) => {
        switch (block.type) {
          case "PARAGRAPH":
            return <p key={block.id}><InlineContent nodes={block.content} /></p>;
          case "HEADING":
            return block.level === 2
              ? <h2 key={block.id}>{block.text}</h2>
              : <h3 key={block.id}>{block.text}</h3>;
          case "PULL_QUOTE":
            return (
              <blockquote key={block.id}>
                <p>{block.text}</p>
                {block.attribution ? <cite>{block.attribution}</cite> : null}
              </blockquote>
            );
          case "IMAGE":
            return <StoryImage item={media[block.mediaId]} key={block.id} />;
          case "IMAGE_PAIR":
            return (
              <div style={imageGridStyle} key={block.id}>
                {block.mediaIds.map((mediaId) => (
                  <StoryImage item={media[mediaId]} key={mediaId} />
                ))}
              </div>
            );
          case "GALLERY":
            return (
              <div style={imageGridStyle} key={block.id}>
                {block.mediaIds.map((mediaId) => (
                  <StoryImage item={media[mediaId]} key={mediaId} />
                ))}
              </div>
            );
          case "EVENT_REFERENCE": {
            const event = events[block.eventId];
            return (
              <aside style={{ display: "grid", gap: ".3rem", padding: "1rem", border: "1px solid #3a3a3a", borderRadius: 10, background: "#141414" }} key={block.id}>
                <span>Evento relacionado</span>
                {event ? (
                  <>
                    <strong>{event.title}</strong>
                    {(event.date || event.location) ? (
                      <small>{[event.date, event.location].filter(Boolean).join(" · ")}</small>
                    ) : null}
                    {event.href ? <a href={event.href}>Ver evento</a> : null}
                  </>
                ) : <strong>Evento no disponible</strong>}
              </aside>
            );
          }
          default: {
            const exhaustive: never = block;
            return exhaustive;
          }
        }
      })}
    </div>
  );
}
