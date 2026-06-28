"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const TIME_ORDER = ["morning", "noon", "evening", "night"];
const TIME_META: Record<string, { label: string; sub: string }> = {
  morning: { label: "Morning", sub: "9–12" },
  noon:    { label: "Noon",    sub: "12–15" },
  evening: { label: "Evening", sub: "15–20" },
  night:   { label: "Night",   sub: "20+" },
};

type Slot  = { id: string; date: string; time_label: string };
type Event = { title: string; created_by: string; restaurant_types: string[] };

export default function RespondClient({ id }: { id: string }) {
  const [event, setEvent]       = useState<Event | null>(null);
  const [slots, setSlots]       = useState<Slot[]>([]);
  const [name, setName]         = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [respondedCount, setRespondedCount] = useState<number | null>(null);

  useEffect(() => {
    // Fetch event data + slots
    Promise.all([
      supabase.from("events").select("title, created_by, restaurant_types").eq("id", id).single(),
      supabase.from("event_slots").select("id, date, time_label").eq("event_id", id).order("date"),
      supabase.from("responses").select("*", { count: "exact", head: true }).eq("event_id", id),
    ]).then(([{ data: ev }, { data: sl }, { count }]) => {
      setEvent(ev);
      setSlots(sl ?? []);
      setRespondedCount(count ?? 0);
      setLoading(false);
    });

    // Live count subscription
    const channel = supabase
      .channel(`respond-count-${id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "responses",
        filter: `event_id=eq.${id}`,
      }, () => setRespondedCount((c) => (c ?? 0) + 1))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const toggle = (slotId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(slotId) ? next.delete(slotId) : next.add(slotId);
      return next;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { data: response, error: rErr } = await supabase
      .from("responses")
      .insert({ event_id: id, friend_name: name.trim() })
      .select("id")
      .single();

    if (rErr || !response) {
      setError("Failed to submit. Please try again.");
      setSubmitting(false);
      return;
    }

    if (selected.size > 0) {
      const rows = [...selected].map((slot_id) => ({ response_id: response.id, slot_id }));
      const { error: sErr } = await supabase.from("response_slots").insert(rows);
      if (sErr) {
        setError("Saved your name but failed to record slot choices.");
        setSubmitting(false);
        return;
      }
    }

    setSubmitted(true);
  };

  const byDate = slots.reduce<Record<string, Slot[]>>((acc, slot) => {
    (acc[slot.date] ??= []).push(slot);
    return acc;
  }, {});
  const sortedDates = Object.keys(byDate).sort();
  for (const date of sortedDates) {
    byDate[date].sort((a, b) => TIME_ORDER.indexOf(a.time_label) - TIME_ORDER.indexOf(b.time_label));
  }

  if (loading) return <Shell>Loading…</Shell>;
  if (!event)  return <Shell>Event not found.</Shell>;

  if (submitted) {
    return (
      <main className="max-w-lg mx-auto px-4 py-24 text-center space-y-3">
        <p className="text-5xl">🎉</p>
        <h2 className="text-xl font-bold text-gray-900">You&apos;re in!</h2>
        <p className="text-sm text-gray-500">
          Thanks {name} — your availability has been recorded.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-10 space-y-8">

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
        <p className="text-sm text-gray-500">
          {event.created_by} is planning a meal — mark when you&apos;re free.
        </p>

        {/* Live count badge */}
        {respondedCount !== null && respondedCount > 0 && (
          <div className="flex items-center gap-1.5 pt-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-green-600 font-medium">
              {respondedCount} {respondedCount === 1 ? "friend has" : "friends have"} already responded
            </span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-7">

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">
            Your name <span className="text-orange-500">*</span>
          </label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jamie"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
        </div>

        {/* Slot grid */}
        {sortedDates.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">When are you free?</p>
            <p className="text-xs text-gray-400">Tap a slot to mark yourself available.</p>
            <div className="space-y-5 pt-1">
              {sortedDates.map((date) => {
                const d = new Date(date + "T00:00:00");
                return (
                  <div key={date}>
                    <p className="text-xs font-semibold text-gray-500 mb-2">
                      {d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {byDate[date].map((slot) => {
                        const { label, sub } = TIME_META[slot.time_label];
                        const on = selected.has(slot.id);
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => toggle(slot.id)}
                            className={`flex flex-col items-center justify-center min-h-12 rounded-xl border-2 transition-colors ${
                              on
                                ? "bg-green-500 border-green-500 text-white"
                                : "bg-white border-gray-200 text-gray-600 hover:border-green-300"
                            }`}
                          >
                            <span className="text-sm font-semibold">{label}</span>
                            <span className={`text-xs mt-0.5 ${on ? "text-green-100" : "text-gray-400"}`}>
                              {sub}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No time slots added yet.</p>
        )}

        {/* Cuisine chips (read-only) */}
        {event.restaurant_types.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-gray-700">Cuisine options</p>
            <div className="flex flex-wrap gap-2">
              {event.restaurant_types.map((type) => (
                <span
                  key={type}
                  className="px-3 py-1 rounded-full text-sm bg-orange-50 text-orange-600 border border-orange-200"
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium hover:bg-orange-600 disabled:opacity-40 transition-colors"
        >
          {submitting ? "Submitting…" : "Submit availability"}
        </button>
      </form>
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="max-w-lg mx-auto px-4 py-20 text-center text-sm text-gray-400">
      {children}
    </main>
  );
}
