"use client";

import { useState } from "react";
import Link from "next/link";
import type { StoryMediaRow, StoryRow } from "@/lib/supabase";
import type { StoryContentBlock, StoryBlockType } from "@/lib/stories/story-types";
import {
  appendStoryBlock,
  moveStoryBlock,
  removeStoryBlock,
  replaceStoryBlock,
} from "@/lib/stories/story-admin";
import { updateStoryAction } from "@/app/admin/historias/actions";
import StoryMediaUploader from "./StoryMediaUploader.client";
import styles from "./StoryAdmin.module.css";

type TaxonomyOption = { value: string; label: string };
type EventOption = { id: string; title: string };

type Props = {
  story: StoryRow;
  media: StoryMediaRow[];
  disciplines: TaxonomyOption[];
  territories: TaxonomyOption[];
  relatedEvents: EventOption[];
};

const ADDABLE_TYPES: StoryBlockType[] = [
  "PARAGRAPH",
  "HEADING",
  "PULL_QUOTE",
  "IMAGE",
  "IMAGE_PAIR",
  "GALLERY",
  "EVENT_REFERENCE",
];

function nextBlockId(type: StoryBlockType) {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${type.toLowerCase()}-${id}`;
}

function emptyBlock(type: StoryBlockType): StoryContentBlock {
  const id = nextBlockId(type);
  switch (type) {
    case "PARAGRAPH": return { id, type, content: [{ type: "TEXT", text: "" }] };
    case "HEADING": return { id, type, level: 2, text: "" };
    case "PULL_QUOTE": return { id, type, text: "", attribution: "" };
    case "IMAGE": return { id, type, mediaId: "" };
    case "IMAGE_PAIR": return { id, type, mediaIds: ["", ""] };
    case "GALLERY": return { id, type, mediaIds: [] };
    case "EVENT_REFERENCE": return { id, type, eventId: "" };
  }
}

function MediaSelect({
  media,
  value,
  onChange,
}: {
  media: StoryMediaRow[];
  value: string;
  onChange(value: string): void;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Sin seleccionar</option>
      {media.map((item) => (
        <option key={item.id} value={item.id}>
          {item.alt_text || item.caption || item.id} · {item.bucket_id}
        </option>
      ))}
    </select>
  );
}

function BlockFields({
  block,
  media,
  events,
  onChange,
}: {
  block: StoryContentBlock;
  media: StoryMediaRow[];
  events: EventOption[];
  onChange(block: StoryContentBlock): void;
}) {
  switch (block.type) {
    case "PARAGRAPH":
      return (
        <textarea
          aria-label="Texto del párrafo"
          rows={5}
          value={block.content.map((node) => node.type === "TEXT" ? node.text : node.children.map(({ text }) => text).join("")).join("")}
          onChange={(event) => onChange({
            ...block,
            content: [{ type: "TEXT", text: event.target.value }],
          })}
        />
      );
    case "HEADING":
      return (
        <div className={styles.inlineFields}>
          <select
            aria-label="Nivel del encabezado"
            value={block.level}
            onChange={(event) => onChange({ ...block, level: Number(event.target.value) as 2 | 3 })}
          >
            <option value={2}>H2</option>
            <option value={3}>H3</option>
          </select>
          <input
            aria-label="Texto del encabezado"
            value={block.text}
            onChange={(event) => onChange({ ...block, text: event.target.value })}
          />
        </div>
      );
    case "PULL_QUOTE":
      return (
        <div className={styles.stack}>
          <textarea
            aria-label="Texto de la cita"
            rows={3}
            value={block.text}
            onChange={(event) => onChange({ ...block, text: event.target.value })}
          />
          <input
            aria-label="Atribución de la cita"
            placeholder="Atribución opcional"
            value={block.attribution ?? ""}
            onChange={(event) => onChange({ ...block, attribution: event.target.value })}
          />
        </div>
      );
    case "IMAGE":
      return <MediaSelect media={media} value={block.mediaId} onChange={(mediaId) => onChange({ ...block, mediaId })} />;
    case "IMAGE_PAIR":
      return (
        <div className={styles.inlineFields}>
          {[0, 1].map((index) => (
            <MediaSelect
              key={index}
              media={media}
              value={block.mediaIds[index]}
              onChange={(mediaId) => {
                const mediaIds = [...block.mediaIds] as [string, string];
                mediaIds[index] = mediaId;
                onChange({ ...block, mediaIds });
              }}
            />
          ))}
        </div>
      );
    case "GALLERY":
      return (
        <div className={styles.stack}>
          {media.length ? media.map((item) => {
            const selected = block.mediaIds.includes(item.id);
            return (
              <label className={styles.checkRow} key={item.id}>
                <input
                  checked={selected}
                  type="checkbox"
                  onChange={(event) => onChange({
                    ...block,
                    mediaIds: event.target.checked
                      ? [...block.mediaIds, item.id]
                      : block.mediaIds.filter((id) => id !== item.id),
                  })}
                />
                {item.alt_text || item.caption || item.id}
              </label>
            );
          }) : <p className={styles.muted}>No hay imágenes cargadas todavía.</p>}
          {block.mediaIds.map((mediaId, index) => (
            <div className={styles.orderRow} key={mediaId}>
              <span>{index + 1}. {mediaId}</span>
              <button
                disabled={index === 0}
                type="button"
                onClick={() => {
                  const mediaIds = [...block.mediaIds];
                  [mediaIds[index - 1], mediaIds[index]] = [mediaIds[index], mediaIds[index - 1]];
                  onChange({ ...block, mediaIds });
                }}
              >Subir</button>
              <button
                disabled={index === block.mediaIds.length - 1}
                type="button"
                onClick={() => {
                  const mediaIds = [...block.mediaIds];
                  [mediaIds[index + 1], mediaIds[index]] = [mediaIds[index], mediaIds[index + 1]];
                  onChange({ ...block, mediaIds });
                }}
              >Bajar</button>
            </div>
          ))}
        </div>
      );
    case "EVENT_REFERENCE":
      return (
        <select value={block.eventId} onChange={(event) => onChange({ ...block, eventId: event.target.value })}>
          <option value="">Selecciona un evento relacionado</option>
          {events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      );
  }
}

export default function StoryEditor({
  story,
  media,
  disciplines,
  territories,
  relatedEvents,
}: Props) {
  const [blocks, setBlocks] = useState<StoryContentBlock[]>(story.content_blocks);
  const [addType, setAddType] = useState<StoryBlockType>("PARAGRAPH");
  const editable = story.status === "DRAFT" || story.status === "READY";

  return (
    <form action={updateStoryAction} className={styles.stack}>
      <input name="id" type="hidden" value={story.id} />
      <input name="expectedUpdatedAt" type="hidden" value={story.updated_at} />
      <input name="contentBlocks" type="hidden" value={JSON.stringify(blocks)} />

      <section className={styles.panel}>
        <h2>Editorial</h2>
        <div className={styles.grid3}>
          <label>Estado
            <select defaultValue={story.status} disabled={!editable} name="status">
              <option value="DRAFT">DRAFT</option>
              <option value="READY">READY</option>
              {!editable ? <option value={story.status}>{story.status}</option> : null}
            </select>
          </label>
          <label>Tipo
            <select defaultValue={story.type} disabled={!editable} name="type">
              <option value="CRONICA">CRÓNICA</option>
              <option value="REPORTAJE">REPORTAJE</option>
              <option value="HISTORIA">HISTORIA</option>
              <option value="ENTREVISTA">ENTREVISTA</option>
            </select>
          </label>
          <label>Colección
            <select defaultValue={story.collection} disabled={!editable} name="collection">
              <option value="DESDE_DENTRO">DESDE DENTRO</option>
              <option value="HISTORIAS_DE_MOTOR">HISTORIAS DE MOTOR</option>
              <option value="CONVERSACIONES">CONVERSACIONES</option>
            </select>
          </label>
        </div>
        <label>Título
          <input defaultValue={story.title} disabled={!editable} maxLength={240} name="title" required />
        </label>
        <label>Entradilla
          <textarea defaultValue={story.dek} disabled={!editable} maxLength={1000} name="dek" rows={3} />
        </label>
        <div className={styles.grid2}>
          <label>Contexto / ubicación
            <input defaultValue={story.context_location ?? ""} disabled={!editable} maxLength={240} name="contextLocation" />
          </label>
          <label>Slug
            <input defaultValue={story.slug} disabled={!editable} maxLength={180} name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
          </label>
        </div>
      </section>

      <section className={styles.panel}>
        <h2>Clasificación</h2>
        <fieldset disabled={!editable}>
          <legend>Disciplinas</legend>
          <div className={styles.checkGrid}>
            {disciplines.map((option) => (
              <label className={styles.checkRow} key={option.value}>
                <input defaultChecked={story.discipline_slugs.includes(option.value)} name="disciplineSlugs" type="checkbox" value={option.value} />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={!editable}>
          <legend>Territorios</legend>
          <div className={styles.checkGrid}>
            {territories.map((option) => (
              <label className={styles.checkRow} key={option.value}>
                <input defaultChecked={story.territory_ids.includes(option.value)} name="territoryIds" type="checkbox" value={option.value} />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className={styles.panel}>
        <h2>Cuerpo estructurado</h2>
        {blocks.map((block, index) => (
          <article className={styles.block} key={block.id}>
            <header>
              <strong>{block.type}</strong>
              {editable ? <div>
                <button disabled={index === 0} type="button" onClick={() => setBlocks(moveStoryBlock(blocks, index, -1))}>Subir</button>
                <button disabled={index === blocks.length - 1} type="button" onClick={() => setBlocks(moveStoryBlock(blocks, index, 1))}>Bajar</button>
                <button type="button" onClick={() => setBlocks(removeStoryBlock(blocks, block.id))}>Eliminar</button>
              </div> : null}
            </header>
            <BlockFields
              block={block}
              events={relatedEvents}
              media={media}
              onChange={(next) => setBlocks(replaceStoryBlock(blocks, next))}
            />
          </article>
        ))}
        {editable ? (
          <div className={styles.inlineFields}>
            <select value={addType} onChange={(event) => setAddType(event.target.value as StoryBlockType)}>
              {ADDABLE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <button type="button" onClick={() => setBlocks(appendStoryBlock(blocks, emptyBlock(addType)))}>Añadir bloque</button>
          </div>
        ) : null}
      </section>

      <section className={styles.panel}>
        <h2>Media</h2>
        <StoryMediaUploader
          editable={editable}
          key={media.map(({ id, updated_at: updatedAt }) => `${id}:${updatedAt}`).join("|")}
          media={media}
          storyId={story.id}
        />
        {media.length ? (
          <label>Hero
            <select defaultValue={story.hero_media_id ?? ""} disabled={!editable} name="heroMediaId">
              <option value="">Sin hero</option>
              {media.map((item) => <option key={item.id} value={item.id}>{item.alt_text || item.caption || item.id}</option>)}
            </select>
          </label>
        ) : null}
      </section>

      <section className={styles.panel}>
        <h2>SEO</h2>
        <label>Título SEO <span className={styles.counter}>máx. 240</span>
          <input defaultValue={story.seo_title} disabled={!editable} maxLength={240} name="seoTitle" />
        </label>
        <label>Descripción SEO <span className={styles.counter}>máx. 600</span>
          <textarea defaultValue={story.seo_description} disabled={!editable} maxLength={600} name="seoDescription" rows={4} />
        </label>
      </section>

      <div className={styles.actions}>
        <Link className={styles.secondary} href={`/admin/historias/${story.id}/preview`}>Abrir Preview privada</Link>
        {editable ? <button className={styles.primary} type="submit">Guardar Story</button> : null}
      </div>
    </form>
  );
}
