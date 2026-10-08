import type { CalEvent, Importance } from "../types";

/** What a collector returns before normalization. */
export interface RawEvent {
  title: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  location?: string;
  url?: string;
  description?: string;
  importance?: Importance;
  confidence: number;
  tags?: CalEvent["tags"];
}
