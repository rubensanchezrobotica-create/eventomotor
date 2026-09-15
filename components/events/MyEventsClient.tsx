"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type Ref } from "react";
import { currentPagePath, eventAnalyticsParams, trackEvent } from "@/lib/analytics";
import { downloadIcsFile } from "@/lib/calendar-export";
import { PUBLIC_NAVIGATION } from "@/lib/public-navigation";
import type { SavedEvent } from "@/lib/saved-events";
import {
  buildSavedEventsViewModel,
  formatSavedEventDate,
  hasValidSavedEventStart,
  localCivilDateKey,
  nextSavedEventFocusSlug,
  readSavedEventsSnapshot,
  removeSavedEventFromSnapshot,
  savedEventsCountLabel,
  type SavedEventDisplayItem,
} from "./my-events-view-model";
import styles from "./MyEventsV2.module.css";

type SavedEventCollectionProps = {
  items: SavedEventDisplayItem[];
  kind: "past" | "undated" | "upcoming";
  onAddToCalendar: (event: SavedEvent) => void;
  onRemove: (event: SavedEvent) => void;
  onRemoveButtonRef?: (slug: string, node: HTMLButtonElement | null) => void;
  title: string;
};

function SavedEventCard({
  item,
  kind,
  onAddToCalendar,
  onRemove,
  onRemoveButtonRef,
}: Omit<SavedEventCollectionProps, "items" | "title"> & { item: SavedEventDisplayItem }) {
  const { event, image } = item;
  const location = [event.city, event.province].filter(Boolean).join(", ");
  const canAddToCalendar = kind === "upcoming" && hasValidSavedEventStart(event);

  return (
    <article className={`${styles.card} ${kind === "past" ? styles.pastCard : ""}`}>
      <div className={styles.media}>
        {image.src ? (
          <Image
            alt=""
            className={styles.mediaImage}
            height={800}
            sizes="(max-width: 760px) 100vw, 50vw"
            src={image.src}
            width={1200}
          />
        ) : (
          <span aria-hidden="true" className={styles.neutralMedia}>
            <strong>EventoMotor</strong>
            <small>Agenda nacional del motor</small>
          </span>
        )}
        {image.label ? <span className={styles.mediaLabel}>Imagen representativa</span> : null}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.metaLine}>
          {event.discipline ? <span>{event.discipline}</span> : null}
          {event.vehicle_type ? <span>{event.vehicle_type}</span> : null}
        </div>
        <p className={styles.date}>{formatSavedEventDate(event)}</p>
        <h3>{event.title}</h3>
        {location ? <p className={styles.location}>{location}</p> : null}
        {event.venue ? <p className={styles.venue}>{event.venue}</p> : null}
        <div className={styles.actions}>
          <Link
            className={styles.primaryAction}
            href={`/evento/${event.slug}`}
            onClick={() => trackEvent("click_event_detail", {
              ...eventAnalyticsParams(event),
              discipline: event.discipline,
              zone: event.province,
              vehicle_type: event.vehicle_type || "otros",
              page_path: currentPagePath(),
              source: "my_events",
            })}
          >
            Ver evento
          </Link>
          {canAddToCalendar ? (
            <button
              className={styles.secondaryAction}
              onClick={() => onAddToCalendar(event)}
              type="button"
            >
              Añadir al calendario
            </button>
          ) : null}
          <button
            aria-label={`Quitar ${event.title} de Mis eventos`}
            className={styles.removeAction}
            onClick={() => onRemove(event)}
            ref={(node) => onRemoveButtonRef?.(event.slug, node)}
            type="button"
          >
            Quitar
          </button>
        </div>
      </div>
    </article>
  );
}

function SavedEventCollection({ items, title, ...props }: SavedEventCollectionProps) {
  if (!items.length) return null;

  return (
    <section aria-labelledby={`saved-events-${props.kind}`} className={styles.collection}>
      <div className={styles.collectionHeading}>
        <h2 id={`saved-events-${props.kind}`}>{title}</h2>
        <span>{items.length}</span>
      </div>
      <div className={styles.cards}>
        {items.map((item) => (
          <SavedEventCard item={item} key={item.event.slug} {...props} />
        ))}
      </div>
    </section>
  );
}

type SavedEventsViewProps = {
  announcement?: string;
  events: SavedEvent[] | null;
  onAddToCalendar: (event: SavedEvent) => void;
  onRemove: (event: SavedEvent) => void;
  onRemoveButtonRef?: (slug: string, node: HTMLButtonElement | null) => void;
  summaryHeadingRef?: Ref<HTMLHeadingElement>;
  today: string;
};

export function SavedEventsView({
  announcement = "",
  events,
  onAddToCalendar,
  onRemove,
  onRemoveButtonRef,
  summaryHeadingRef,
  today,
}: SavedEventsViewProps) {
  if (events === null) {
    return (
      <div aria-busy="true" aria-live="polite" className={styles.loading}>
        <span aria-hidden="true" />
        <p>Cargando tus eventos guardados…</p>
      </div>
    );
  }

  const model = buildSavedEventsViewModel(events, today);
  const countLabel = savedEventsCountLabel(events.length);

  return (
    <div className={styles.content}>
      <p aria-live="polite" className={styles.srOnly} role="status">{announcement}</p>
      <section aria-labelledby="saved-events-summary" className={styles.summary}>
        <div>
          <span>Guardados en este dispositivo</span>
          <h2 id="saved-events-summary" ref={summaryHeadingRef} tabIndex={-1}>{countLabel}</h2>
          <p>Tu selección permanece en este navegador y no necesita una cuenta.</p>
        </div>
        <strong aria-hidden="true">{events.length}</strong>
      </section>

      {events.length ? (
        <>
          <div className={styles.collections}>
            <SavedEventCollection
              items={model.upcoming}
              kind="upcoming"
              onAddToCalendar={onAddToCalendar}
              onRemove={onRemove}
              onRemoveButtonRef={onRemoveButtonRef}
              title="Próximos"
            />
            <SavedEventCollection
              items={model.undated}
              kind="undated"
              onAddToCalendar={onAddToCalendar}
              onRemove={onRemove}
              onRemoveButtonRef={onRemoveButtonRef}
              title="Sin fecha"
            />
            <SavedEventCollection
              items={model.past}
              kind="past"
              onAddToCalendar={onAddToCalendar}
              onRemove={onRemove}
              onRemoveButtonRef={onRemoveButtonRef}
              title="Pasados"
            />
          </div>
          <section aria-labelledby="saved-events-discovery" className={styles.discovery}>
            <span>Sigue descubriendo</span>
            <h2 id="saved-events-discovery">Encuentra tu próximo plan de motor</h2>
            <Link href={PUBLIC_NAVIGATION.calendar}>Explorar eventos</Link>
          </section>
        </>
      ) : (
        <section aria-labelledby="saved-events-empty-title" className={styles.emptyState}>
          <span>Tu agenda</span>
          <h2 id="saved-events-empty-title">Todavía no has<br />guardado<br />eventos</h2>
          <p>
            Guarda los eventos que te interesen con el control «Guardar» o el corazón para encontrarlos aquí rápidamente.
          </p>
          <div className={styles.emptyActions}>
            <Link className={styles.primaryAction} href={PUBLIC_NAVIGATION.calendar}>Explorar eventos</Link>
            <Link className={styles.secondaryAction} href={PUBLIC_NAVIGATION.disciplines}>Explorar disciplinas</Link>
          </div>
        </section>
      )}
    </div>
  );
}

export default function MyEventsClient() {
  const [events, setEvents] = useState<SavedEvent[] | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const removeButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const summaryHeadingRef = useRef<HTMLHeadingElement>(null);
  const today = localCivilDateKey();

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setEvents(readSavedEventsSnapshot(window.localStorage));
    }, 0);
    trackEvent("open_my_events", { page_path: currentPagePath() });
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  function remove(event: SavedEvent) {
    if (!events) return;
    const focusSlug = nextSavedEventFocusSlug(events, event.slug, today);
    const next = removeSavedEventFromSnapshot(window.localStorage, event.slug);
    setEvents(next);
    setAnnouncement(`${event.title} se ha quitado de Mis eventos.`);
    trackEvent("remove_saved_event", {
      ...eventAnalyticsParams(event),
      page_path: currentPagePath(),
      source: "my_events",
    });

    window.requestAnimationFrame(() => {
      if (focusSlug) {
        removeButtonRefs.current.get(focusSlug)?.focus();
      } else {
        summaryHeadingRef.current?.focus();
      }
    });
  }

  function addToCalendar(event: SavedEvent) {
    downloadIcsFile(`${event.slug}.ics`, [event]);
    trackEvent("add_to_calendar", {
      ...eventAnalyticsParams(event),
      page_path: currentPagePath(),
      source: "my_events",
    });
  }

  return (
    <SavedEventsView
      announcement={announcement}
      events={events}
      onAddToCalendar={addToCalendar}
      onRemove={remove}
      onRemoveButtonRef={(slug, node) => {
        if (node) removeButtonRefs.current.set(slug, node);
        else removeButtonRefs.current.delete(slug);
      }}
      summaryHeadingRef={summaryHeadingRef}
      today={today}
    />
  );
}
