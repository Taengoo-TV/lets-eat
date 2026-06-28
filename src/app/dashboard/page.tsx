"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type EventSlot = { id: string; date: string; time_label: string };
type Response  = { id: string; response_slots: { slot_id: string }[] };
type Event = {
  id: string;
  title: string;
  location_text: string | null;
  restaurant_types: string[];
  created_at: string;
  event_slots: EventSlot[];
  responses: Response[];
};

const TIME_LABEL: Record<string, string> = {
  morning: "Morning",
  noon: "Noon",
  evening: "Evening",
  night: "Night",
};

function bestSlot(event: Event): string | null {
  const votes = new Map<string, number>();
  for (const r of event.responses) {
    for (const rs of r.response_slots) {
      votes.set(rs.slot_id, (votes.get(rs.slot_id) ?? 0) + 1);
    }
  }
  if (votes.size === 0) return null;
  const topId = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const slot = event.event_slots.find((s) => s.id === topId);
  if (!slot) return null;
  const date = new Date(slot.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${date}, ${TIME_LABEL[slot.time_label] ?? slot.time_label}`;
}

export default function DashboardPage() {
  const [events, setEvents]   = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("events")
      .select("id, title, location_text, restaurant_types, created_at, event_slots(id, date, time_label), responses(id, response_slots(slot_id))")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setEvents((data as Event[]) ?? []);
        setLoading(false);
      });
  }, []);

  const copyInvite = async (id: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/event/${id}/respond`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-20 text-center text-sm text-gray-400">
        Loading…
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-zinc-900">Your dining plans</h1>
        <Link
          href="/create"
          className="shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#E8593C" }}
        >
          Create new plan
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <p className="text-4xl">🍽️</p>
          <p className="text-gray-500">No dining plans yet</p>
          <Link
            href="/create"
            className="inline-block rounded-full px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#E8593C" }}
          >
            Create your first plan
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {events.map((event) => {
            const best  = bestSlot(event);
            const count = event.responses.length;
            return (
              <li key={event.id} className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4 shadow-sm">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-zinc-900">{event.title}</h2>
                  {event.location_text && (
                    <p className="text-sm text-gray-500">📍 {event.location_text}</p>
                  )}
                </div>

                {event.restaurant_types.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {event.restaurant_types.map((t) => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span>{count} {count === 1 ? "response" : "responses"}</span>
                  {best && (
                    <>
                      <span className="text-stone-300">/</span>
                      <span className="text-green-600 font-medium">★ {best}</span>
                    </>
                  )}
                </div>

                <div className="flex gap-3">
                  <Link
                    href={`/event/${event.id}`}
                    className="flex-1 text-center rounded-xl py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "#E8593C" }}
                  >
                    View results
                  </Link>
                  <button
                    onClick={() => copyInvite(event.id)}
                    className="flex-1 rounded-xl py-3 text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {copiedId === event.id ? "Copied!" : "Copy invite link"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
