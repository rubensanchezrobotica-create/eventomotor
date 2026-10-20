"use client";
import type { StoryInlineNode, StoryParagraphBlock } from "@/lib/stories/story-types";

/** Changes one node, never flattening or reconstructing neighbouring links/marks. */
export function replaceParagraphNode(block: StoryParagraphBlock, index: number, node: StoryInlineNode): StoryParagraphBlock {
  return { ...block, content: block.content.map((current, i) => i === index ? node : current) };
}

export default function StoryParagraphEditor({ block, onChange }: {
  block: StoryParagraphBlock; onChange(block: StoryParagraphBlock): void;
}) {
  return <div>
    {block.content.map((node, index) => node.type === "TEXT" ?
      <label key={index}>Texto del párrafo{block.content.length > 1 ? ` · fragmento ${index + 1}` : ""}
        <textarea rows={4} value={node.text} onChange={(e) => onChange(replaceParagraphNode(block, index, { ...node, text: e.target.value }))} />
      </label> : <fieldset key={index}>
        <legend>Enlace {index + 1}</legend>
        {node.children.map((child, childIndex) => <label key={childIndex}>Texto del enlace
          <input value={child.text} onChange={(e) => onChange(replaceParagraphNode(block, index, {
            ...node, children: node.children.map((current, i) => i === childIndex ? { ...current, text: e.target.value } : current),
          }))} />
        </label>)}
        <label>URL<input inputMode="url" value={node.href} onChange={(e) => onChange(replaceParagraphNode(block, index, { ...node, href: e.target.value }))} /></label>
        <label><input type="checkbox" checked={node.sponsored === true} onChange={(e) => onChange(replaceParagraphNode(block, index, { ...node, sponsored: e.target.checked }))} /> Enlace patrocinado (sponsored)</label>
      </fieldset>)}
    <button type="button" onClick={() => onChange({ ...block, content: [...block.content, { type: "TEXT", text: "" }] })}>Añadir fragmento de texto</button>
    <button type="button" onClick={() => onChange({ ...block, content: [...block.content, { type: "LINK", href: "", children: [{ type: "TEXT", text: "" }] }] })}>Añadir enlace</button>
  </div>;
}
