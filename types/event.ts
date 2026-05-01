export type EventStatus = "finalizado" | "en directo" | "proximo";

export interface EventItem {
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
  level: string;
  source: string;
  sourceUrl: string;
  ticketUrl: string;
  tags: string[];
  featured: boolean;
}

export interface SourceFeed {
  id: string;
  name: string;
  url: string;
  type: string;
}

export type SyncState = "fallback" | "loading" | "live";

export type ViewMode = "calendario" | "anual" | "lista" | "zonas";

export type StatusFilter = "proximos" | "todos" | "finalizado" | "en directo";
