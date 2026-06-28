import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import RespondClient from "./RespondClient";

type Props = { params: Promise<{ id: string }> };

async function getEventMeta(id: string) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [{ data: event }, { data: slots }] = await Promise.all([
    sb.from("events").select("title, created_by, restaurant_types").eq("id", id).single(),
    sb.from("event_slots").select("date").eq("event_id", id).order("date"),
  ]);
  return { event, slots };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { event, slots } = await getEventMeta(id);
  if (!event) return { title: "Event not found" };

  const dates = (slots ?? []).map((s) => s.date);
  const dateRange =
    dates.length === 0 ? "" :
    dates.length === 1
      ? new Date(dates[0] + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : `${new Date(dates[0] + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(dates[dates.length - 1] + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const description = [
    `${event.created_by} is planning a meal`,
    dateRange,
    event.restaurant_types?.join(", "),
    "Tap to pick your availability!",
  ].filter(Boolean).join(" · ");

  return {
    title: `Join: ${event.title}`,
    description,
    openGraph: {
      title: `🍜 ${event.title}`,
      description,
      type: "website",
    },
    twitter: { card: "summary", title: `🍜 ${event.title}`, description },
  };
}

export default async function RespondPage({ params }: Props) {
  const { id } = await params;
  return <RespondClient id={id} />;
}
