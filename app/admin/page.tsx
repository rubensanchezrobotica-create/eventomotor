"use client";

import type React from "react";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import Link from "next/link";

const DATA_QUALITY_OPTIONS = ["needs_review", "reviewed", "published", "draft", "pending_date", "cancelled"];
const VEHICLE_TYPE_OPTIONS = ["moto", "coche", "mixto", "karting", "otros"];
const DATE_FILTERS = ["proximos", "pasados", "todos"] as const;
const VISIBLE_FILTERS = ["todos", "visibles", "ocultos"] as const;

const QUALITY_LABELS: Record<string, string> = {
  needs_review: "Necesita revisión",
  draft: "Borrador",
  reviewed: "Revisado",
  published: "Publicado",
  cancelled: "Cancelado",
  pending_date: "Sin fecha confirmada",
};

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  moto: "Moto",
  coche: "Coche",
  mixto: "Mixto",
  karting: "Karting",
  otros: "Otros",
};

const IMPORT_METHOD_OPTIONS = ["manual-web-research", "seed", "rfme", "scraper", "manual"];
const EVENT_STATUS_OPTIONS = ["", "confirmed", "tentative", "postponed", "cancelled"] as const;
const EVENT_STATUS_LABELS: Record<string, string> = {
  "": "Sin definir",
  confirmed: "Confirmado",
  tentative: "Pendiente de confirmar",
  postponed: "Aplazado",
  cancelled: "Cancelado",
};
const SOURCE_TYPE_OPTIONS = ["", "official", "organizer", "federation", "circuit", "municipality", "media", "aggregator", "unknown"] as const;
const SOURCE_TYPE_LABELS: Record<string, string> = {
  "": "Sin definir",
  official: "Oficial",
  organizer: "Organizador",
  federation: "Federación",
  circuit: "Circuito",
  municipality: "Ayuntamiento",
  media: "Medio / noticia",
  aggregator: "Agregador",
  unknown: "Desconocido",
};

type AdminEvent = {
  id: string;
  title: string;
  championship: string | null;
  discipline: string | null;
  start_date: string;
  end_date: string | null;
  venue: string | null;
  city: string | null;
  province: string | null;
  region: string | null;
  level: string | null;
  source: string | null;
  source_url: string | null;
  ticket_url: string | null;
  country: string | null;
  event_status: string | null;
  short_description: string | null;
  long_description: string | null;
  schedule_text: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  organizer_name: string | null;
  organizer_url: string | null;
  official_url: string | null;
  registration_url: string | null;
  image_url: string | null;
  image_source_url: string | null;
  verified_at: string | null;
  source_type: string | null;
  confidence_score: number | null;
  needs_review: boolean | null;
  tags: string[] | null;
  vehicle_type: string | null;
  featured: boolean | null;
  visible: boolean | null;
  import_method: string | null;
  data_quality: string | null;
  notes: string | null;
};

type EventForm = {
  id: string;
  title: string;
  championship: string;
  discipline: string;
  start: string;
  end: string;
  venue: string;
  city: string;
  province: string;
  region: string;
  source: string;
  sourceUrl: string;
  ticketUrl: string;
  country: string;
  eventStatus: string;
  shortDescription: string;
  longDescription: string;
  scheduleText: string;
  address: string;
  latitude: string;
  longitude: string;
  organizerName: string;
  organizerUrl: string;
  officialUrl: string;
  registrationUrl: string;
  imageUrl: string;
  imageSourceUrl: string;
  verifiedAt: string;
  sourceType: string;
  confidenceScore: string;
  needsReview: "unset" | "true" | "false";
  vehicleType: string;
  featured: boolean;
  visible: boolean;
  importMethod: string;
  dataQuality: string;
  notes: string;
  tags: string;
};

type Filters = {
  search: string;
  vehicleType: string;
  visible: (typeof VISIBLE_FILTERS)[number];
  dataQuality: string;
  importMethod: string;
  discipline: string;
  province: string;
  date: (typeof DATE_FILTERS)[number];
  featured: "todos" | "destacados";
  reviewOnly: boolean;
  missingSource: boolean;
  missingLocation: boolean;
};

type EventsResponse = { ok: true; events: AdminEvent[] } | { ok: false; error: string };
type EventMutationResponse = { ok: true; event: AdminEvent } | { ok: false; error: string };

const EMPTY_FILTERS: Filters = {
  search: "",
  vehicleType: "todos",
  visible: "todos",
  dataQuality: "todos",
  importMethod: "todos",
  discipline: "todas",
  province: "todas",
  date: "proximos",
  featured: "todos",
  reviewOnly: false,
  missingSource: false,
  missingLocation: false,
};

function emptyForm(): EventForm {
  return {
    id: "",
    title: "",
    championship: "",
    discipline: "",
    start: "",
    end: "",
    venue: "",
    city: "",
    province: "",
    region: "",
    source: "",
    sourceUrl: "",
    ticketUrl: "",
    country: "",
    eventStatus: "",
    shortDescription: "",
    longDescription: "",
    scheduleText: "",
    address: "",
    latitude: "",
    longitude: "",
    organizerName: "",
    organizerUrl: "",
    officialUrl: "",
    registrationUrl: "",
    imageUrl: "",
    imageSourceUrl: "",
    verifiedAt: "",
    sourceType: "",
    confidenceScore: "",
    needsReview: "unset",
    vehicleType: "otros",
    featured: false,
    visible: true,
    importMethod: "manual",
    dataQuality: "needs_review",
    notes: "",
    tags: "",
  };
}

function normalizeText(value: string | null | undefined) {
  return value?.trim() || "";
}

function normalized(value: string | null | undefined) {
  return normalizeText(value).toLowerCase();
}

function isMissingEditorialValue(value: string | null | undefined) {
  const current = normalized(value);
  return !current || current === "a confirmar" || current === "por confirmar";
}

function reviewReasons(event: AdminEvent) {
  const reasons: string[] = [];
  const dataQuality = event.data_quality || "";

  if (dataQuality === "needs_review") reasons.push("calidad needs_review");
  if (isMissingEditorialValue(event.venue)) reasons.push("ubicación pendiente");
  if (isMissingEditorialValue(event.city)) reasons.push("ciudad pendiente");
  if (isMissingEditorialValue(event.province)) reasons.push("provincia pendiente");
  if (!event.source_url?.trim()) reasons.push("fuente pendiente");
  if (!event.title?.trim()) reasons.push("título pendiente");
  if (!event.start_date?.trim()) reasons.push("fecha pendiente");
  if (!event.vehicle_type?.trim() || event.vehicle_type === "otros") reasons.push("tipo de vehículo pendiente");
  if (!event.discipline?.trim()) reasons.push("disciplina pendiente");
  if (normalized(event.notes).includes("duda") || normalized(event.notes).includes("revisar")) reasons.push("notas con dudas");
  if (event.visible !== false && dataQuality === "needs_review") reasons.push("visible con revisión pendiente");

  return reasons;
}

function needsEditorialReview(event: AdminEvent) {
  return reviewReasons(event).length > 0;
}

function numberToFormValue(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function timestampToDatetimeLocalValue(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return localDate.toISOString().slice(0, 16);
}

function optionToFormValue<T extends readonly string[]>(value: string | null | undefined, options: T) {
  return value && options.includes(value) ? value : "";
}

function datetimeLocalToTimestamptz(value: string) {
  if (!value.trim()) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function needsReviewToFormValue(value: boolean | null | undefined): EventForm["needsReview"] {
  if (value === true) return "true";
  if (value === false) return "false";

  return "unset";
}

function eventToForm(event: AdminEvent): EventForm {
  return {
    id: event.id,
    title: event.title || "",
    championship: event.championship || "",
    discipline: event.discipline || "",
    start: event.start_date || "",
    end: event.end_date || event.start_date || "",
    venue: event.venue || "",
    city: event.city || "",
    province: event.province || "",
    region: event.region || "",
    source: event.source || "",
    sourceUrl: event.source_url || "",
    ticketUrl: event.ticket_url || "",
    country: event.country || "",
    eventStatus: optionToFormValue(event.event_status, EVENT_STATUS_OPTIONS),
    shortDescription: event.short_description || "",
    longDescription: event.long_description || "",
    scheduleText: event.schedule_text || "",
    address: event.address || "",
    latitude: numberToFormValue(event.latitude),
    longitude: numberToFormValue(event.longitude),
    organizerName: event.organizer_name || "",
    organizerUrl: event.organizer_url || "",
    officialUrl: event.official_url || "",
    registrationUrl: event.registration_url || "",
    imageUrl: event.image_url || "",
    imageSourceUrl: event.image_source_url || "",
    verifiedAt: timestampToDatetimeLocalValue(event.verified_at),
    sourceType: optionToFormValue(event.source_type, SOURCE_TYPE_OPTIONS),
    confidenceScore: numberToFormValue(event.confidence_score),
    needsReview: needsReviewToFormValue(event.needs_review),
    vehicleType: event.vehicle_type || "otros",
    featured: Boolean(event.featured),
    visible: event.visible !== false,
    importMethod: event.import_method || "",
    dataQuality: event.data_quality || "needs_review",
    notes: event.notes || "",
    tags: event.tags?.join(", ") || "",
  };
}

function mergeEvent(events: AdminEvent[], event: AdminEvent) {
  return events
    .map((currentEvent) => (currentEvent.id === event.id ? event : currentEvent))
    .sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(normalizeText).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"));
}

function formatDate(date: string | null | undefined) {
  if (!date) return "Sin fecha";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function isPast(event: AdminEvent) {
  const endDate = event.end_date || event.start_date;
  const today = new Date().toISOString().slice(0, 10);
  return endDate < today;
}

function matchesSearch(event: AdminEvent, search: string) {
  const query = normalized(search);

  if (!query) return true;

  return [
    event.title,
    event.city,
    event.province,
    event.venue,
    event.source,
    event.discipline,
    event.championship,
    event.import_method,
  ]
    .map(normalized)
    .some((value) => value.includes(query));
}

function matchesFilters(event: AdminEvent, filters: Filters) {
  if (!matchesSearch(event, filters.search)) return false;
  if (filters.vehicleType !== "todos" && event.vehicle_type !== filters.vehicleType) return false;
  if (filters.visible === "visibles" && event.visible === false) return false;
  if (filters.visible === "ocultos" && event.visible !== false) return false;
  if (filters.dataQuality !== "todos" && event.data_quality !== filters.dataQuality) return false;
  if (filters.importMethod !== "todos" && !(event.import_method || "").includes(filters.importMethod)) return false;
  if (filters.discipline !== "todas" && event.discipline !== filters.discipline) return false;
  if (filters.province !== "todas" && event.province !== filters.province) return false;
  if (filters.date === "proximos" && isPast(event)) return false;
  if (filters.date === "pasados" && !isPast(event)) return false;
  if (filters.featured === "destacados" && !event.featured) return false;
  if (filters.reviewOnly && !needsEditorialReview(event)) return false;
  if (filters.missingSource && event.source_url?.trim()) return false;
  if (filters.missingLocation && !isMissingEditorialValue(event.venue) && !isMissingEditorialValue(event.city) && !isMissingEditorialValue(event.province)) return false;

  return true;
}

function validateForm(form: EventForm) {
  if (!form.id.trim()) return "El ID es obligatorio.";
  if (!form.title.trim()) return "El título es obligatorio.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.start)) return "La fecha de inicio debe usar YYYY-MM-DD.";
  if (form.end && !/^\d{4}-\d{2}-\d{2}$/.test(form.end)) return "La fecha de fin debe usar YYYY-MM-DD.";
  if (form.latitude.trim() && !Number.isFinite(Number(form.latitude))) return "La latitud debe ser numerica.";
  if (form.longitude.trim() && !Number.isFinite(Number(form.longitude))) return "La longitud debe ser numerica.";

  if (form.confidenceScore.trim()) {
    const confidenceScore = Number(form.confidenceScore);

    if (!Number.isInteger(confidenceScore) || confidenceScore < 0 || confidenceScore > 100) {
      return "El confidence_score debe estar entre 0 y 100.";
    }
  }

  if (form.verifiedAt.trim() && !datetimeLocalToTimestamptz(form.verifiedAt)) {
    return "verified_at debe ser una fecha y hora valida.";
  }

  return "";
}

function formToPayload(form: EventForm) {
  return {
    ...form,
    eventStatus: form.eventStatus || null,
    sourceType: form.sourceType || null,
    verifiedAt: datetimeLocalToTimestamptz(form.verifiedAt),
    confidenceScore: form.confidenceScore.trim() ? Number(form.confidenceScore) : null,
    needsReview: form.needsReview === "unset" ? null : form.needsReview === "true",
  };
}

function Chip({
  active,
  children,
  onClick,
  tone = "default",
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  tone?: "default" | "success" | "warning" | "danger" | "vehicle";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
      : tone === "warning"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
        : tone === "danger"
          ? "border-red-500/30 bg-red-500/10 text-red-100"
          : tone === "vehicle"
            ? "border-sky-500/30 bg-sky-500/10 text-sky-100"
            : "border-white/[0.08] bg-white/[0.035] text-zinc-300";
  const className = `inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold transition ${
    active ? "border-red-400/70 bg-red-500/15 text-red-50" : toneClass
  }`;

  if (!onClick) {
    return <span className={className}>{children}</span>;
  }

  return (
    <button className={`${className} hover:border-red-400/60 hover:text-white`} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
  title,
  tone = "secondary",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  tone?: "primary" | "secondary" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "primary"
      ? "border-red-500/70 bg-red-600/90 text-white hover:bg-red-500"
      : tone === "success"
        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100 hover:border-emerald-400"
        : tone === "warning"
          ? "border-amber-500/40 bg-amber-500/15 text-amber-100 hover:border-amber-400"
          : tone === "danger"
            ? "border-red-500/40 bg-red-500/10 text-red-100 hover:border-red-400"
            : "border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-zinc-500";

  return (
    <button
      className={`min-h-9 rounded-md border px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${toneClass}`}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

function Field({
  children,
  helper,
  label,
}: {
  children: React.ReactNode;
  helper?: string;
  label: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-400">
      {label}
      {children}
      {helper ? <span className="text-[11px] font-medium leading-4 text-zinc-500">{helper}</span> : null}
    </label>
  );
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [form, setForm] = useState<EventForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const disciplines = useMemo(() => uniqueSorted(events.map((event) => event.discipline)), [events]);
  const provinces = useMemo(() => uniqueSorted(events.map((event) => event.province)), [events]);

  const filteredEvents = useMemo(
    () => events.filter((event) => matchesFilters(event, filters)),
    [events, filters],
  );

  const counts = useMemo(
    () => ({
      total: events.length,
      moto: events.filter((event) => event.vehicle_type === "moto").length,
      coche: events.filter((event) => event.vehicle_type === "coche").length,
      mixto: events.filter((event) => event.vehicle_type === "mixto").length,
      visible: events.filter((event) => event.visible !== false).length,
      hidden: events.filter((event) => event.visible === false).length,
      featured: events.filter((event) => event.featured).length,
      review: events.filter(needsEditorialReview).length,
      reviewed: events.filter((event) => event.data_quality === "reviewed").length,
      published: events.filter((event) => event.data_quality === "published").length,
      pendingDate: events.filter((event) => event.data_quality === "pending_date" || !event.start_date).length,
      missingSource: events.filter((event) => !event.source_url?.trim()).length,
      missingLocation: events.filter((event) => isMissingEditorialValue(event.venue) || isMissingEditorialValue(event.city) || isMissingEditorialValue(event.province)).length,
    }),
    [events],
  );

  function setFilter<K extends keyof Filters>(field: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function applyCounterFilter(nextFilters: Partial<Filters>) {
    setFilters({ ...EMPTY_FILTERS, date: "todos", ...nextFilters });
  }

  function updateForm(field: keyof EventForm, value: string | boolean) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  async function loadEvents(adminSecret = secret) {
    setIsLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/events", {
        headers: {
          authorization: `Bearer ${adminSecret}`,
        },
      });
      const payload = (await response.json()) as EventsResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "No se pudieron cargar los eventos." : payload.error);
      }

      setEvents(payload.events);
      setSelectedIds(new Set());
      setIsAuthenticated(true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadEvents();
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const validationError = validateForm(form);

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/events", {
        method: editingId ? "PUT" : "POST",
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(formToPayload(form)),
      });
      const payload = (await response.json()) as EventMutationResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "No se pudo guardar el evento." : payload.error);
      }

      setEvents((currentEvents) => mergeEvent(currentEvents, payload.event));
      setEditingId(null);
      setForm(emptyForm());
      setNotice("Cambios guardados.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function patchEvent(
    event: AdminEvent,
    requestPayload: { featured?: boolean; visible?: boolean; dataQuality?: string; vehicleType?: string; notes?: string },
    successMessage: string,
  ) {
    setUpdatingId(event.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/events", {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ id: event.id, ...requestPayload }),
      });
      const payload = (await response.json()) as EventMutationResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "No se pudo actualizar el evento." : payload.error);
      }

      setEvents((currentEvents) => mergeEvent(currentEvents, payload.event));
      setNotice(successMessage);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : String(updateError));
    } finally {
      setUpdatingId(null);
    }
  }

  function editEvent(event: AdminEvent) {
    setForm(eventToForm(event));
    setEditingId(event.id);
    setError("");
    setNotice("");
  }

  function clearForm() {
    setForm(emptyForm());
    setEditingId(null);
    setError("");
  }

  function handleInputChange(field: keyof EventForm) {
    return (event: ChangeEvent<HTMLInputElement>) => updateForm(field, event.target.value);
  }

  function handleSelectChange(field: keyof EventForm) {
    return (event: ChangeEvent<HTMLSelectElement>) => updateForm(field, event.target.value);
  }

  function handleTextareaChange(event: ChangeEvent<HTMLTextAreaElement>) {
    updateForm("notes", event.target.value);
  }

  function handleTextareaFieldChange(field: keyof EventForm) {
    return (event: ChangeEvent<HTMLTextAreaElement>) => updateForm(field, event.target.value);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function toggleAllFiltered() {
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected = filteredEvents.length > 0 && filteredEvents.every((event) => next.has(event.id));

      if (allSelected) {
        filteredEvents.forEach((event) => next.delete(event.id));
      } else {
        filteredEvents.forEach((event) => next.add(event.id));
      }

      return next;
    });
  }

  async function runBulkAction() {
    if (!bulkAction || selectedIds.size === 0) return;

    if ((bulkAction === "hide" || bulkAction === "cancelled") && !window.confirm("¿Aplicar este cambio en lote?")) {
      return;
    }

    const selectedEvents = events.filter((event) => selectedIds.has(event.id));
    const payload =
      bulkAction === "reviewed"
        ? { dataQuality: "reviewed" }
        : bulkAction === "published"
          ? { dataQuality: "published", visible: true }
          : bulkAction === "hide"
            ? { visible: false }
            : bulkAction === "cancelled"
              ? { dataQuality: "cancelled" }
              : bulkAction.startsWith("vehicle:")
                ? { vehicleType: bulkAction.replace("vehicle:", "") }
                : bulkAction.startsWith("quality:")
                  ? { dataQuality: bulkAction.replace("quality:", "") }
                  : null;

    if (!payload) return;

    setIsSaving(true);
    setNotice("");
    setError("");

    try {
      for (const event of selectedEvents) {
        await patchEvent(event, payload, "");
      }

      setNotice(`Acción aplicada a ${selectedEvents.length} eventos.`);
      setSelectedIds(new Set());
      setBulkAction("");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#09090b] px-4 py-5 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[94rem] flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-400/90">EventoMotor</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Mesa editorial de eventos</h1>
            <p className="mt-1.5 text-sm text-zinc-400">
              Revisa, filtra, corrige y publica eventos importados sin perder contexto.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="min-h-9 w-fit rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-bold text-zinc-100 hover:border-white/[0.16]"
              href="/admin/event-submissions"
            >
              Solicitudes recibidas
            </Link>
            {isAuthenticated ? (
              <button
                className="min-h-9 w-fit rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-bold text-zinc-100 hover:border-white/[0.16]"
                onClick={() => loadEvents()}
                type="button"
              >
                Refrescar eventos
              </button>
            ) : null}
          </div>
        </header>

        <section className="rounded-lg border border-white/[0.07] bg-white/[0.035] p-3.5">
          <form className="flex max-w-2xl flex-col gap-3 sm:flex-row" onSubmit={handleLogin}>
            <Field label="Clave de administración">
              <input
                className="min-h-10 rounded-md border border-white/[0.08] bg-black/30 px-3 text-sm text-white outline-none focus:border-red-400/80"
                onChange={(event) => setSecret(event.target.value)}
                placeholder="Introduce ADMIN_SECRET"
                type="password"
                value={secret}
              />
            </Field>
            <button
              className="min-h-10 self-end rounded-md bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
              disabled={isLoading || !secret.trim()}
              type="submit"
            >
              {isLoading ? "Cargando" : "Entrar"}
            </button>
          </form>
          {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
          {notice ? <p className="mt-3 text-sm text-emerald-300">{notice}</p> : null}
        </section>

        {isAuthenticated ? (
          <>
            <section className="rounded-lg border border-white/[0.07] bg-[#111216] p-3.5">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Contadores rápidos</h2>
                  <p className="text-xs text-zinc-500">Pulsa un chip para aplicar ese filtro.</p>
                </div>
                <p className="text-xs text-zinc-500">
                  Mostrando {filteredEvents.length} de {events.length}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Chip active={filters.date === "todos" && filters.vehicleType === "todos" && !filters.reviewOnly} onClick={() => setFilters({ ...EMPTY_FILTERS, date: "todos" })}>
                  Total {counts.total}
                </Chip>
                <Chip active={filters.vehicleType === "moto"} onClick={() => applyCounterFilter({ vehicleType: "moto" })} tone="vehicle">
                  Motos {counts.moto}
                </Chip>
                <Chip active={filters.vehicleType === "coche"} onClick={() => applyCounterFilter({ vehicleType: "coche" })} tone="vehicle">
                  Coches {counts.coche}
                </Chip>
                <Chip active={filters.vehicleType === "mixto"} onClick={() => applyCounterFilter({ vehicleType: "mixto" })} tone="vehicle">
                  Mixtos {counts.mixto}
                </Chip>
                <Chip active={filters.visible === "visibles"} onClick={() => applyCounterFilter({ visible: "visibles" })} tone="success">
                  Visibles {counts.visible}
                </Chip>
                <Chip active={filters.visible === "ocultos"} onClick={() => applyCounterFilter({ visible: "ocultos" })} tone="danger">
                  Ocultos {counts.hidden}
                </Chip>
                <Chip active={filters.featured === "destacados"} onClick={() => applyCounterFilter({ featured: "destacados" })} tone="warning">
                  Destacados {counts.featured}
                </Chip>
                <Chip active={filters.reviewOnly} onClick={() => applyCounterFilter({ reviewOnly: true })} tone="warning">
                  Necesitan revisión {counts.review}
                </Chip>
                <Chip active={filters.dataQuality === "reviewed"} onClick={() => applyCounterFilter({ dataQuality: "reviewed" })} tone="success">
                  Revisados {counts.reviewed}
                </Chip>
                <Chip active={filters.dataQuality === "published"} onClick={() => applyCounterFilter({ dataQuality: "published" })} tone="success">
                  Publicados {counts.published}
                </Chip>
                <Chip active={filters.dataQuality === "pending_date"} onClick={() => applyCounterFilter({ dataQuality: "pending_date" })} tone="warning">
                  Sin fecha confirmada {counts.pendingDate}
                </Chip>
                <Chip active={filters.missingSource} onClick={() => applyCounterFilter({ missingSource: true })} tone="warning">
                  Sin fuente {counts.missingSource}
                </Chip>
                <Chip active={filters.missingLocation} onClick={() => applyCounterFilter({ missingLocation: true })} tone="warning">
                  Sin ubicación clara {counts.missingLocation}
                </Chip>
              </div>
            </section>

            <section className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-3.5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Buscar">
                  <input
                    className="min-h-10 rounded-md border border-white/[0.08] bg-black/30 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-red-400/80"
                    onChange={(event) => setFilter("search", event.target.value)}
                    placeholder="Título, ciudad, fuente, disciplina..."
                    type="search"
                    value={filters.search}
                  />
                </Field>
                <Field label="Tipo de vehículo">
                  <select className="admin-select" onChange={(event) => setFilter("vehicleType", event.target.value)} value={filters.vehicleType}>
                    <option value="todos">Todos</option>
                    {VEHICLE_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{VEHICLE_TYPE_LABELS[option]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Estado visible">
                  <select className="admin-select" onChange={(event) => setFilter("visible", event.target.value as Filters["visible"])} value={filters.visible}>
                    <option value="todos">Todos</option>
                    <option value="visibles">Visibles</option>
                    <option value="ocultos">Ocultos</option>
                  </select>
                </Field>
                <Field label="Calidad editorial">
                  <select className="admin-select" onChange={(event) => setFilter("dataQuality", event.target.value)} value={filters.dataQuality}>
                    <option value="todos">Todos</option>
                    {DATA_QUALITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>{QUALITY_LABELS[option]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Método de importación">
                  <select className="admin-select" onChange={(event) => setFilter("importMethod", event.target.value)} value={filters.importMethod}>
                    <option value="todos">Todos</option>
                    {IMPORT_METHOD_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </Field>
                <Field label="Disciplina">
                  <select className="admin-select" onChange={(event) => setFilter("discipline", event.target.value)} value={filters.discipline}>
                    <option value="todas">Todas</option>
                    {disciplines.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </Field>
                <Field label="Provincia">
                  <select className="admin-select" onChange={(event) => setFilter("province", event.target.value)} value={filters.province}>
                    <option value="todas">Todas</option>
                    {provinces.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </Field>
                <Field label="Fecha">
                  <select className="admin-select" onChange={(event) => setFilter("date", event.target.value as Filters["date"])} value={filters.date}>
                    <option value="proximos">Próximos</option>
                    <option value="pasados">Pasados</option>
                    <option value="todos">Todos</option>
                  </select>
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton onClick={() => setFilters(EMPTY_FILTERS)} title="Limpia todos los filtros.">
                  Limpiar filtros
                </ActionButton>
                <ActionButton onClick={toggleAllFiltered} title="Selecciona o deselecciona todos los eventos filtrados.">
                  {filteredEvents.length > 0 && filteredEvents.every((event) => selectedIds.has(event.id)) ? "Deseleccionar filtrados" : "Seleccionar filtrados"}
                </ActionButton>
              </div>
            </section>

            <section className="rounded-lg border border-white/[0.07] bg-[#101114] p-3.5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Cambios masivos</h2>
                  <p className="text-xs text-zinc-500">{selectedIds.size} eventos seleccionados.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(14rem,22rem)_auto]">
                  <select className="admin-select" onChange={(event) => setBulkAction(event.target.value)} value={bulkAction}>
                    <option value="">Elige una acción</option>
                    <option value="reviewed">Marcar revisados</option>
                    <option value="published">Publicar</option>
                    <option value="hide">Ocultar</option>
                    <option value="cancelled">Marcar como cancelados</option>
                    {VEHICLE_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={`vehicle:${option}`}>Cambiar tipo a {VEHICLE_TYPE_LABELS[option]}</option>
                    ))}
                    {DATA_QUALITY_OPTIONS.map((option) => (
                      <option key={option} value={`quality:${option}`}>Cambiar calidad a {QUALITY_LABELS[option]}</option>
                    ))}
                  </select>
                  <ActionButton disabled={!bulkAction || selectedIds.size === 0 || isSaving} onClick={runBulkAction} title="Aplica la acción a los eventos seleccionados." tone="primary">
                    Aplicar
                  </ActionButton>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              {filteredEvents.map((event) => {
                const isUpdating = updatingId === event.id;
                const isVisible = event.visible !== false;
                const isFeatured = Boolean(event.featured);
                const reasons = reviewReasons(event);
                const sourceUrl = event.source_url?.trim();
                const ticketUrl = event.ticket_url?.trim();
                const officialUrl = event.official_url?.trim();
                const hasEventV2Data = Boolean(
                  event.country ||
                    event.event_status ||
                    event.short_description ||
                    event.official_url ||
                    event.registration_url ||
                    event.image_url ||
                    event.verified_at ||
                    event.needs_review === true ||
                    event.needs_review === false,
                );

                return (
                  <article
                    className={`rounded-lg border px-3.5 py-3 shadow-[0_12px_34px_rgba(0,0,0,0.16)] ${
                      editingId === event.id ? "border-red-500/40 bg-[#171316]" : "border-white/[0.07] bg-[#15161A]/88"
                    }`}
                    key={event.id}
                  >
                    <div className="grid gap-3 xl:grid-cols-[auto_minmax(0,1fr)_minmax(18rem,auto)] xl:items-start">
                      <label className="flex items-start gap-2 pt-1 text-xs text-zinc-400">
                        <input checked={selectedIds.has(event.id)} className="mt-1 h-4 w-4" onChange={() => toggleSelected(event.id)} type="checkbox" />
                      </label>
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-1.5">
                          <Chip tone="vehicle">{getVehicleTypeLabel(event.vehicle_type)}</Chip>
                          <Chip tone={event.data_quality === "published" || event.data_quality === "reviewed" ? "success" : event.data_quality === "cancelled" ? "danger" : "warning"}>
                            {QUALITY_LABELS[event.data_quality || ""] || event.data_quality || "Sin estado"}
                          </Chip>
                          <Chip tone={isVisible ? "success" : "danger"}>{isVisible ? "Visible" : "Oculto"}</Chip>
                          {isFeatured ? <Chip tone="warning">Destacado</Chip> : null}
                          {event.import_method ? <Chip>{event.import_method}</Chip> : null}
                        </div>
                        <h3 className="mt-2 text-base font-semibold leading-6 text-white">{event.title || "Sin título"}</h3>
                        <p className="mt-1 text-sm text-zinc-400">
                          {formatDate(event.start_date)} · {event.city || "Ciudad pendiente"}, {event.province || "Provincia pendiente"} · {event.discipline || "Disciplina pendiente"}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {event.source || "Sin fuente"} · {event.venue || "Lugar pendiente"}
                        </p>
                        <div className="mt-3 grid gap-1.5 text-xs text-zinc-500 md:grid-cols-2">
                          <p><span className="text-zinc-300">Campeonato:</span> {event.championship || "Pendiente"}</p>
                          <p><span className="text-zinc-300">Región:</span> {event.region || "Pendiente"}</p>
                          <p className="truncate" title={sourceUrl || ""}><span className="text-zinc-300">Source URL:</span> {sourceUrl || "Pendiente"}</p>
                          <p className="truncate" title={ticketUrl || ""}><span className="text-zinc-300">Ticket URL:</span> {ticketUrl || "Sin entradas"}</p>
                          {hasEventV2Data ? (
                            <p className="truncate md:col-span-2" title={officialUrl || ""}>
                              <span className="text-zinc-300">Event v2:</span> {event.country || "Pais pendiente"} · {event.event_status || "Estado pendiente"} · Official URL: {officialUrl || "Pendiente"}
                            </p>
                          ) : null}
                          <p className="md:col-span-2"><span className="text-zinc-300">Notas:</span> {event.notes || "Sin notas"}</p>
                        </div>
                        {reasons.length ? (
                          <p className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-100">
                            Motivos: {reasons.join(", ")}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-1.5 xl:justify-end">
                        <ActionButton disabled={isUpdating} onClick={() => editEvent(event)} title="Editar debajo de esta tarjeta." tone="primary">Editar</ActionButton>
                        <ActionButton disabled={isUpdating} onClick={() => patchEvent(event, { dataQuality: "reviewed" }, "Evento marcado como revisado.")} title="Marca el evento como revisado." tone="success">Revisado</ActionButton>
                        <ActionButton disabled={isUpdating} onClick={() => patchEvent(event, { dataQuality: "published", visible: true }, "Evento publicado y visible.")} title="Marca el evento como publicado y visible." tone="success">Publicado</ActionButton>
                        <ActionButton disabled={isUpdating} onClick={() => patchEvent(event, { visible: !isVisible }, isVisible ? "Evento ocultado." : "Evento visible.")} title={isVisible ? "Oculta el evento." : "Muestra el evento."} tone={isVisible ? "danger" : "success"}>
                          {isVisible ? "Ocultar" : "Mostrar"}
                        </ActionButton>
                        <ActionButton disabled={isUpdating} onClick={() => patchEvent(event, { featured: !isFeatured }, isFeatured ? "Evento retirado de destacados." : "Evento destacado.")} title={isFeatured ? "Quita destacado." : "Marca como destacado."} tone="warning">
                          {isFeatured ? "Quitar destacado" : "Destacar"}
                        </ActionButton>
                        <ActionButton disabled={isUpdating} onClick={() => patchEvent(event, { dataQuality: "cancelled" }, "Evento marcado como cancelado.")} title="Marca el evento como cancelado." tone="danger">Cancelado</ActionButton>
                        <select
                          className="min-h-9 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs font-bold text-zinc-100 outline-none"
                          disabled={isUpdating}
                          onChange={(changeEvent) => patchEvent(event, { vehicleType: changeEvent.target.value }, `Tipo cambiado a ${VEHICLE_TYPE_LABELS[changeEvent.target.value]}.`)}
                          title="Cambia el tipo de vehículo."
                          value={event.vehicle_type || "otros"}
                        >
                          {VEHICLE_TYPE_OPTIONS.map((option) => (
                            <option key={option} value={option}>{VEHICLE_TYPE_LABELS[option]}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {editingId === event.id ? (
                      <form className="mt-3 rounded-lg border border-red-500/20 bg-[#0f1013] p-3.5" onSubmit={saveEvent}>
                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-red-300">Editando evento</p>
                            <h4 className="text-sm font-semibold text-white">{event.title}</h4>
                          </div>
                          <ActionButton onClick={clearForm} title="Cancela la edición.">Cancelar</ActionButton>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          <Field label="Título"><input className="admin-input" onChange={handleInputChange("title")} value={form.title} /></Field>
                          <Field label="Fecha inicio"><input className="admin-input" onChange={handleInputChange("start")} value={form.start} /></Field>
                          <Field label="Fecha fin"><input className="admin-input" onChange={handleInputChange("end")} value={form.end} /></Field>
                          <Field label="Disciplina"><input className="admin-input" onChange={handleInputChange("discipline")} value={form.discipline} /></Field>
                          <Field label="Tipo de vehículo">
                            <select className="admin-select" onChange={handleSelectChange("vehicleType")} value={form.vehicleType}>
                              {VEHICLE_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{VEHICLE_TYPE_LABELS[option]}</option>)}
                            </select>
                          </Field>
                          <Field label="Campeonato"><input className="admin-input" onChange={handleInputChange("championship")} value={form.championship} /></Field>
                          <Field label="Circuito/lugar"><input className="admin-input" onChange={handleInputChange("venue")} value={form.venue} /></Field>
                          <Field label="Ciudad"><input className="admin-input" onChange={handleInputChange("city")} value={form.city} /></Field>
                          <Field label="Provincia"><input className="admin-input" onChange={handleInputChange("province")} value={form.province} /></Field>
                          <Field label="Comunidad/región"><input className="admin-input" onChange={handleInputChange("region")} value={form.region} /></Field>
                          <Field label="Fuente"><input className="admin-input" onChange={handleInputChange("source")} value={form.source} /></Field>
                          <Field label="Source URL"><input className="admin-input" onChange={handleInputChange("sourceUrl")} value={form.sourceUrl} /></Field>
                          <Field label="Ticket URL"><input className="admin-input" onChange={handleInputChange("ticketUrl")} value={form.ticketUrl} /></Field>
                          <Field label="Calidad editorial">
                            <select className="admin-select" onChange={handleSelectChange("dataQuality")} value={form.dataQuality}>
                              {DATA_QUALITY_OPTIONS.map((option) => <option key={option} value={option}>{QUALITY_LABELS[option]}</option>)}
                            </select>
                          </Field>
                          <Field label="Etiquetas"><input className="admin-input" onChange={handleInputChange("tags")} value={form.tags} /></Field>
                          <div className="flex items-end gap-4">
                            <label className="flex min-h-10 items-center gap-2 text-sm text-zinc-300">
                              <input checked={form.visible} className="h-4 w-4" onChange={(changeEvent) => updateForm("visible", changeEvent.target.checked)} type="checkbox" />
                              Visible
                            </label>
                            <label className="flex min-h-10 items-center gap-2 text-sm text-zinc-300">
                              <input checked={form.featured} className="h-4 w-4" onChange={(changeEvent) => updateForm("featured", changeEvent.target.checked)} type="checkbox" />
                              Destacado
                            </label>
                          </div>
                          <Field label="Notas">
                            <textarea className="admin-input min-h-20 md:col-span-2 xl:col-span-4" onChange={handleTextareaChange} value={form.notes} />
                          </Field>
                        </div>
                        <details className="mt-3 rounded-lg border border-white/[0.08] bg-white/[0.025] p-3">
                          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-zinc-300">
                            Datos avanzados Event v2
                          </summary>
                          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                            <Field label="country"><input className="admin-input" onChange={handleInputChange("country")} value={form.country} /></Field>
                            <Field helper="Estado editorial del evento para SEO y avisos al usuario." label="event_status">
                              <select className="admin-select" onChange={handleSelectChange("eventStatus")} value={form.eventStatus}>
                                {EVENT_STATUS_OPTIONS.map((option) => (
                                  <option key={option || "unset"} value={option}>{EVENT_STATUS_LABELS[option]}</option>
                                ))}
                              </select>
                            </Field>
                            <Field label="address"><input className="admin-input" onChange={handleInputChange("address")} value={form.address} /></Field>
                            <Field helper="Fecha de última comprobación manual o automática." label="verified_at">
                              <input className="admin-input" onChange={handleInputChange("verifiedAt")} type="datetime-local" value={form.verifiedAt} />
                            </Field>
                            <Field label="latitude"><input className="admin-input" inputMode="decimal" onChange={handleInputChange("latitude")} value={form.latitude} /></Field>
                            <Field label="longitude"><input className="admin-input" inputMode="decimal" onChange={handleInputChange("longitude")} value={form.longitude} /></Field>
                            <Field helper="Confianza interna del dato, de 0 a 100." label="confidence_score">
                              <input className="admin-input" max={100} min={0} onChange={handleInputChange("confidenceScore")} step={1} type="number" value={form.confidenceScore} />
                            </Field>
                            <Field helper="Marca interna para revisar datos antes de publicar o destacar." label="needs_review">
                              <select className="admin-select" onChange={handleSelectChange("needsReview")} value={form.needsReview}>
                                <option value="unset">Sin definir</option>
                                <option value="true">Sí</option>
                                <option value="false">No</option>
                              </select>
                            </Field>
                            <Field label="organizer_name"><input className="admin-input" onChange={handleInputChange("organizerName")} value={form.organizerName} /></Field>
                            <Field label="organizer_url"><input className="admin-input" onChange={handleInputChange("organizerUrl")} value={form.organizerUrl} /></Field>
                            <Field label="official_url"><input className="admin-input" onChange={handleInputChange("officialUrl")} value={form.officialUrl} /></Field>
                            <Field label="registration_url"><input className="admin-input" onChange={handleInputChange("registrationUrl")} value={form.registrationUrl} /></Field>
                            <Field label="image_url"><input className="admin-input" onChange={handleInputChange("imageUrl")} value={form.imageUrl} /></Field>
                            <Field label="image_source_url"><input className="admin-input" onChange={handleInputChange("imageSourceUrl")} value={form.imageSourceUrl} /></Field>
                            <Field helper="Tipo de fuente usada para verificar el evento." label="source_type">
                              <select className="admin-select" onChange={handleSelectChange("sourceType")} value={form.sourceType}>
                                {SOURCE_TYPE_OPTIONS.map((option) => (
                                  <option key={option || "unset"} value={option}>{SOURCE_TYPE_LABELS[option]}</option>
                                ))}
                              </select>
                            </Field>
                            <Field label="short_description">
                              <textarea className="admin-input min-h-20" onChange={handleTextareaFieldChange("shortDescription")} value={form.shortDescription} />
                            </Field>
                            <Field label="long_description">
                              <textarea className="admin-input min-h-24" onChange={handleTextareaFieldChange("longDescription")} value={form.longDescription} />
                            </Field>
                            <Field label="schedule_text">
                              <textarea className="admin-input min-h-24" onChange={handleTextareaFieldChange("scheduleText")} value={form.scheduleText} />
                            </Field>
                          </div>
                        </details>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                          <ActionButton onClick={clearForm} title="Cancela la edición.">Cancelar</ActionButton>
                          <button
                            className="min-h-9 rounded-md bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
                            disabled={isSaving}
                            type="submit"
                          >
                            {isSaving ? "Guardando" : "Guardar cambios"}
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </article>
                );
              })}

              {!filteredEvents.length ? (
                <div className="rounded-lg border border-dashed border-white/[0.10] bg-white/[0.03] p-8 text-center">
                  <h3 className="text-lg font-semibold text-white">No hay eventos con esos filtros</h3>
                  <p className="mt-1 text-sm text-zinc-500">Prueba a limpiar filtros o cambiar la búsqueda.</p>
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
      <style jsx global>{`
        .admin-input,
        .admin-select {
          min-height: 2.5rem;
          border-radius: 0.375rem;
          border: 1px solid rgba(255,255,255,.08);
          background: rgba(0,0,0,.30);
          padding: 0 0.75rem;
          color: white;
          font-size: .875rem;
          outline: none;
        }
        textarea.admin-input {
          padding-top: .5rem;
          padding-bottom: .5rem;
        }
        .admin-input:focus,
        .admin-select:focus {
          border-color: rgba(248,113,113,.80);
        }
        .admin-select option {
          background: #101114;
          color: white;
        }
      `}</style>
    </main>
  );
}

function getVehicleTypeLabel(value: string | null | undefined) {
  return value ? VEHICLE_TYPE_LABELS[value] || value : "Otros";
}
