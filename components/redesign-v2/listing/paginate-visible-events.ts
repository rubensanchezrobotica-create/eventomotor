import { rebalanceVisibleV2EventImages } from "../discipline-fallback-resolver";
import type { PreviewEvent, ResolvedEventImage } from "../redesign-v2-model";

type PaginateVisibleEventsOptions = {
  events: readonly PreviewEvent[];
  imageByEventId: Readonly<Record<string, ResolvedEventImage>>;
  page: number;
  pageSize: number;
};

export function paginateVisibleEvents({
  events,
  imageByEventId,
  page,
  pageSize,
}: PaginateVisibleEventsOptions) {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(events.length / safePageSize));
  const normalizedPage = Math.min(Math.max(1, Math.floor(page)), pageCount);
  const start = (normalizedPage - 1) * safePageSize;
  const visible = events.slice(start, start + safePageSize);
  const visibleImages = rebalanceVisibleV2EventImages(
    visible,
    visible.map((event) => imageByEventId[event.id]),
  );

  return {
    page: normalizedPage,
    pageCount,
    total: events.length,
    visible,
    visibleImages,
  };
}
