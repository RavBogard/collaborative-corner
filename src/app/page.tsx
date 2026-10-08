import { CalendarApp, type SourceMeta } from "@/components/CalendarApp";
import { getDataset } from "@/lib/data";
import { SOURCES } from "@/lib/sources";

export default async function Home() {
  const data = await getDataset();
  const sources: SourceMeta[] = SOURCES.map(({ id, name, category, area }) => ({ id, name, category, area }));
  // keep the client payload lean
  const events = data.events.map(({ description, ...e }) => ({
    ...e,
    description: description?.slice(0, 220),
  }));
  return <CalendarApp events={events} sources={sources} generatedAt={data.generatedAt} />;
}
