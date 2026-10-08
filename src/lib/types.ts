export type Category =
  | "institution"
  | "synagogue"
  | "day-school"
  | "public-school"
  | "holiday"
  | "community-sheet";

export type FetchType = "ical" | "webpage" | "pdf" | "sheet" | "hebcal";

export interface FetchSpec {
  type: FetchType;
  url: string;
  note?: string;
}

export interface Source {
  id: string;
  name: string;
  category: Category;
  area: string;
  website?: string;
  fetch: FetchSpec[];
  notes?: string;
}

export type Importance = "major" | "regular";

/** A normalized event. Dates are local Atlanta (America/New_York). */
export interface CalEvent {
  id: string;
  sourceId: string;
  title: string;
  /** YYYY-MM-DD local start date */
  startDate: string;
  /** YYYY-MM-DD local end date, inclusive */
  endDate: string;
  /** HH:mm local, absent for all-day */
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  location?: string;
  url?: string;
  description?: string;
  importance: Importance;
  /** 0..1; < LOW_CONFIDENCE shows a "verify" badge */
  confidence: number;
  tags?: {
    /** hosting org when the source is an aggregator (e.g. the community sheet) */
    host?: string;
    featuredGuest?: string;
    collaboration?: string;
    /** school closure / break / early release */
    schoolClosure?: boolean;
  };
}

export interface SourceStatus {
  sourceId: string;
  lastAttempt: string;
  lastSuccess?: string;
  eventCount: number;
  error?: string;
  fetchedVia?: FetchType;
}

export interface Dataset {
  generatedAt: string;
  events: CalEvent[];
  status: SourceStatus[];
}

export const LOW_CONFIDENCE = 0.7;
export const TZ = "America/New_York";
