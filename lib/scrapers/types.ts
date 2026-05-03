export type RawEvent = {
  id?: string;
  title: string;
  championship?: string;
  discipline?: string;
  start: string;
  end?: string;
  venue?: string;
  city?: string;
  province?: string;
  region?: string;
  level?: string;
  source: string;
  sourceId?: string;
  sourceUrl?: string;
  ticketUrl?: string;
  tags?: string[];
  featured?: boolean;
};
