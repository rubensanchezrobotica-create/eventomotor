import { notFound } from "next/navigation";
import StoryEditor from "@/components/admin/stories/StoryEditor.client";
import styles from "@/components/admin/stories/StoryAdmin.module.css";
import { SEO_DISCIPLINES } from "@/lib/seo-taxonomy";
import { SPANISH_TERRITORIES } from "@/lib/regions/territory-contract";
import {
  getStoryForAdmin,
  searchEventsForStoryAdmin,
} from "@/lib/stories/story-admin.server";
import {
  createEditorialPersonAction,
  replaceStoryCreditsAction,
  replaceStoryEventsAction,
} from "../actions";

function messageFor(error: string | string[] | undefined) {
  if (error === "story_version_conflict") return "La historia ha cambiado desde que abriste esta versión.";
  if (error === "story_slug_conflict") return "El slug ya pertenece a otra historia.";
  if (error) return "No se pudo guardar la sección. Revisa sus datos.";
  return null;
}

export default async function StoryEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const bundle = await getStoryForAdmin(id);
  if (!bundle) notFound();
  const eventQuery = typeof query.eventQuery === "string" ? query.eventQuery : "";
  const searchResults = eventQuery ? await searchEventsForStoryAdmin(eventQuery) : [];
  const eventOptions = [...bundle.relatedEvents];
  for (const event of searchResults) {
    if (!eventOptions.some(({ id: existingId }) => existingId === event.id)) eventOptions.push(event);
  }
  const editable = bundle.story.status === "DRAFT" || bundle.story.status === "READY";
  const errorMessage = messageFor(query.error);

  return (
    <div className={styles.stack}>
      <div>
        <p className={styles.eyebrow}>{bundle.story.status} · {bundle.story.type}</p>
        <h1>{bundle.story.title || "Historia sin título"}</h1>
        <p className={styles.lede}>Actualizada {new Date(bundle.story.updated_at).toLocaleString("es-ES")}</p>
      </div>
      {query.created ? <p className={styles.notice}>Borrador creado.</p> : null}
      {query.saved ? <p className={styles.notice}>Sección guardada.</p> : null}
      {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
      {!editable ? <p className={styles.notice}>PUBLISHED/ARCHIVED es de sólo lectura en A16C.</p> : null}
      <StoryEditor
        disciplines={SEO_DISCIPLINES.map(({ slug, title }) => ({ value: slug, label: title }))}
        media={bundle.media}
        relatedEvents={bundle.relatedEvents.map(({ id: eventId, title }) => ({ id: eventId, title }))}
        story={bundle.story}
        territories={SPANISH_TERRITORIES.map(({ id: territoryId, displayName }) => ({ value: territoryId, label: displayName }))}
      />

      <section className={styles.panel} id="credits">
        <h2>Créditos</h2>
        {editable ? (
          <>
            <form action={createEditorialPersonAction} className={styles.inlineFields}>
              <input name="storyId" type="hidden" value={id} />
              <label>Nueva persona editorial <input maxLength={240} name="displayName" required /></label>
              <button type="submit">Crear o reutilizar</button>
            </form>
            <form action={replaceStoryCreditsAction} className={styles.stack}>
              <input name="storyId" type="hidden" value={id} />
              <input name="expectedUpdatedAt" type="hidden" value={bundle.story.updated_at} />
              {bundle.people.map((person) => {
                const credit = bundle.credits.find(({ person_id }) => person_id === person.id);
                return (
                  <div className={styles.inlineFields} key={person.id}>
                    <label className={styles.checkRow}>
                      <input defaultChecked={Boolean(credit)} name="creditPersonId" type="checkbox" value={person.id} />
                      {person.display_name}
                    </label>
                    <select defaultValue={credit?.role ?? "TEXT"} name={`creditRole:${person.id}`}>
                      <option value="TEXT">TEXT</option><option value="PHOTO">PHOTO</option>
                      <option value="VIDEO">VIDEO</option><option value="CONTRIBUTOR">CONTRIBUTOR</option>
                    </select>
                  </div>
                );
              })}
              {!bundle.people.length ? <p className={styles.muted}>No hay personas editoriales.</p> : null}
              <button type="submit">Guardar créditos</button>
            </form>
          </>
        ) : <p>{bundle.credits.length} créditos asociados.</p>}
      </section>

      <section className={styles.panel} id="events">
        <h2>Eventos relacionados</h2>
        {editable ? (
          <>
            <form className={styles.inlineFields} method="get">
              <label>Buscar por título <input defaultValue={eventQuery} minLength={2} name="eventQuery" /></label>
              <button type="submit">Buscar eventos</button>
            </form>
            <form action={replaceStoryEventsAction} className={styles.stack}>
              <input name="storyId" type="hidden" value={id} />
              <input name="expectedUpdatedAt" type="hidden" value={bundle.story.updated_at} />
              {eventOptions.map((event) => {
                const relation = bundle.eventRelations.find(({ event_id }) => event_id === event.id);
                return (
                  <div className={styles.inlineFields} key={event.id}>
                    <label className={styles.checkRow}>
                      <input defaultChecked={Boolean(relation)} name="eventId" type="checkbox" value={event.id} />
                      {event.title} · {event.start_date} · {[event.venue, event.city, event.province].filter(Boolean).join(", ")}
                    </label>
                    <select defaultValue={relation?.relation_type ?? "RELATED"} name={`eventRelation:${event.id}`}>
                      <option value="PRIMARY">PRIMARY</option><option value="RELATED">RELATED</option>
                    </select>
                  </div>
                );
              })}
              {!eventOptions.length ? <p className={styles.muted}>Busca por título para relacionar eventos sin cargar el catálogo completo.</p> : null}
              <button type="submit">Guardar eventos</button>
            </form>
          </>
        ) : <p>{bundle.eventRelations.length} eventos asociados.</p>}
      </section>
    </div>
  );
}
