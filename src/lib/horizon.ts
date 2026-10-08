/**
 * Collection window: start of the current school year through the end of the
 * next one (school years run Aug 1 – Jul 31).
 */
export function horizon(now = new Date()): { start: string; end: string } {
  const y = now.getFullYear();
  const schoolYearStart = now.getMonth() >= 7 ? y : y - 1;
  return {
    start: `${schoolYearStart}-08-01`,
    end: `${schoolYearStart + 2}-07-31`,
  };
}

export function inHorizon(startDate: string, endDate: string, h = horizon()) {
  return endDate >= h.start && startDate <= h.end;
}
