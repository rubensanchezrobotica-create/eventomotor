import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import SearchPageExperience from "@/components/redesign-v2/search/SearchPageExperience.client";
import {
  buildSearchPageHref,
  buildSearchPageResults,
  parseSearchPageState,
} from "@/components/redesign-v2/search/search-page-model";
import V2PreviewShell from "@/components/redesign-v2/site/V2PreviewShell";
import { assignV2HomeEventImages } from "@/components/redesign-v2/discipline-fallback-resolver";
import {
  isRedesignPreviewAvailable,
  prioritizeEditorialEvents,
  projectPreviewEvent,
  upcomingPreviewEvents,
} from "@/components/redesign-v2/redesign-v2-model";
import { getVisibleEvents } from "@/lib/public-events";

export const metadata: Metadata = {
  title: "Buscar eventos de motor | Preview EventoMotor V2",
  description: "Busca próximos eventos de motor por fecha, ubicación, disciplina y vehículo.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RedesignV2SearchPage({ searchParams }: SearchPageProps) {
  await connection();
  if (!isRedesignPreviewAvailable()) notFound();

  const nowIso = new Date().toISOString();
  const rawEvents = await getVisibleEvents();
  const upcoming = upcomingPreviewEvents(rawEvents.map(projectPreviewEvent), nowIso);
  const events = prioritizeEditorialEvents(upcoming);
  const resolvedImages = assignV2HomeEventImages(events);
  const imageByEventId = Object.fromEntries(
    events.map((event, index) => [event.id, resolvedImages[index]]),
  );
  const initialState = parseSearchPageState(await searchParams);
  const initialResults = buildSearchPageResults(events, initialState, imageByEventId);
  if (initialResults.page !== initialState.page) {
    redirect(buildSearchPageHref({ ...initialState, page: initialResults.page }));
  }

  return (
    <V2PreviewShell
      breadcrumbs={[{ label: "Inicio", navigationId: "home" }, { label: "Buscar" }]}
      currentNavigationId="search"
      description="Encuentra concentraciones, carreras, rutas, trackdays y planes de motor en toda España."
      eyebrow="Agenda motor"
      title="Buscar eventos de motor"
      upcomingCount={events.length}
    >
      <SearchPageExperience
        events={events}
        imageByEventId={imageByEventId}
        initialState={initialState}
        nowIso={nowIso}
      />
    </V2PreviewShell>
  );
}
