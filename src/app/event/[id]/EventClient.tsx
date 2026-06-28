"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const TIME_ORDER = ["morning", "noon", "evening", "night"];
const TIME_LABEL: Record<string, string> = {
  morning: "Morning · 9–12",
  noon:    "Noon · 12–15",
  evening: "Evening · 15–20",
  night:   "Night · 20+",
};

type EventSlot = { id: string; date: string; time_label: string };
type Response  = {
  id: string;
  friend_name: string;
  submitted_at: string;
  response_slots: { slot_id: string }[];
};
type EventInfo = {
  title: string;
  created_by: string;
  location_text: string | null;
  restaurant_types: string[];
};

export default function EventClient({ id }: { id: string }) {
  const [event, setEvent]           = useState<EventInfo | null>(null);
  const [eventSlots, setEventSlots] = useState<EventSlot[]>([]);
  const [responses, setResponses]   = useState<Response[]>([]);
  const [loading, setLoading]       = useState(true);
  const [copied, setCopied]         = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiShown = useRef(false);

  useEffect(() => {
    async function load() {
      const [{ data: ev }, { data: sl }, { data: rs }] = await Promise.all([
        supabase
          .from("events")
          .select("title, created_by, location_text, restaurant_types")
          .eq("id", id)
          .single(),
        supabase
          .from("event_slots")
          .select("id, date, time_label")
          .eq("event_id", id)
          .order("date"),
        supabase
          .from("responses")
          .select("id, friend_name, submitted_at, response_slots(slot_id)")
          .eq("event_id", id)
          .order("submitted_at"),
      ]);
      if (ev) setEvent(ev);
      setEventSlots(sl ?? []);
      setResponses((rs ?? []) as Response[]);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel(`event-${id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "responses",
        filter: `event_id=eq.${id}`,
      }, load)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "response_slots",
      }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const copyInvite = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/event/${id}/respond`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Derived data ────────────────────────────────────────────
  const totalResponded = responses.length;

  const slotCount = (slotId: string) =>
    responses.filter((r) => r.response_slots.some((rs) => rs.slot_id === slotId)).length;

  const byDate = eventSlots.reduce<Record<string, EventSlot[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});
  const sortedDates = Object.keys(byDate).sort();
  for (const d of sortedDates) {
    byDate[d].sort((a, b) => TIME_ORDER.indexOf(a.time_label) - TIME_ORDER.indexOf(b.time_label));
  }

  const topSlotIds = new Set(
    [...eventSlots]
      .map((s) => ({ id: s.id, n: slotCount(s.id) }))
      .filter((s) => s.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 2)
      .map((s) => s.id)
  );

  // Confetti when any slot hits 100% (with ≥2 responses)
  const hasFullSlot =
    totalResponded >= 2 &&
    eventSlots.some((s) => slotCount(s.id) === totalResponded);

  useEffect(() => {
    if (hasFullSlot && !confettiShown.current) {
      confettiShown.current = true;
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 3500);
      return () => clearTimeout(t);
    }
  }, [hasFullSlot]);

  if (loading) return <Shell>Loading…</Shell>;
  if (!event)  return <Shell>Event not found.</Shell>;

  return (
    <>
      {showConfetti && <Confetti />}

      <main className="max-w-lg mx-auto px-4 py-10 space-y-8">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{event.title}</h1>
            <p className="text-sm text-gray-500">by {event.created_by}</p>
            {event.location_text && (
              <p className="text-sm text-gray-500">📍 {event.location_text}</p>
            )}
            {event.restaurant_types.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {event.restaurant_types.map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={copyInvite}
            className="shrink-0 px-3 py-1.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
          >
            {copied ? "Copied!" : "Copy invite link"}
          </button>
        </div>

        {/* ── Availability heat map ───────────────────────────── */}
        {eventSlots.length > 0 && (
          <section className="space-y-5">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                Availability
              </h2>
              <span className="text-xs text-gray-400">
                {totalResponded} {totalResponded === 1 ? "response" : "responses"}
              </span>
            </div>

            <div className="space-y-6">
              {sortedDates.map((date) => {
                const d = new Date(date + "T00:00:00");
                return (
                  <div key={date}>
                    <p className="text-xs font-semibold text-gray-500 mb-3">
                      {d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                    </p>
                    <div className="space-y-2.5">
                      {byDate[date].map((slot) => {
                        const count = slotCount(slot.id);
                        const pct   = totalResponded > 0 ? (count / totalResponded) * 100 : 0;
                        const isTop = topSlotIds.has(slot.id);
                        return (
                          <div key={slot.id}>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-sm font-medium flex items-center gap-1 ${isTop ? "text-green-700" : "text-gray-700"}`}>
                                {isTop && <span className="text-green-500">★</span>}
                                {TIME_LABEL[slot.time_label]}
                              </span>
                              <span className="text-xs tabular-nums text-gray-400">
                                {count}/{totalResponded}
                              </span>
                            </div>
                            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${isTop ? "bg-green-400" : "bg-orange-300"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Friend responses ────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Who&apos;s responded
          </h2>
          {responses.length === 0 ? (
            <p className="text-sm text-gray-400 italic">
              No responses yet — share the invite link!
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {responses.map((r) => {
                const friendSlots = eventSlots
                  .filter((es) => r.response_slots.some((rs) => rs.slot_id === es.id))
                  .sort(
                    (a, b) =>
                      a.date.localeCompare(b.date) ||
                      TIME_ORDER.indexOf(a.time_label) - TIME_ORDER.indexOf(b.time_label)
                  );
                return (
                  <li key={r.id} className="flex items-start gap-3 py-3">
                    <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {r.friend_name[0].toUpperCase()}
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{r.friend_name}</p>
                      {friendSlots.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {friendSlots.map((slot) => (
                            <span
                              key={slot.id}
                              className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200"
                            >
                              {new Date(slot.date + "T00:00:00").toLocaleDateString("en-US", {
                                month: "short", day: "numeric",
                              })}
                              {" · "}
                              {TIME_LABEL[slot.time_label].split(" · ")[0]}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">No slots selected</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

      </main>
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="max-w-lg mx-auto px-4 py-20 text-center text-sm text-gray-400">
      {children}
    </main>
  );
}

function Confetti() {
  const pieces = useRef(
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: `${(i * 2.6) % 100}%`,
      color: ["#E8593C", "#FBBF24", "#34D399", "#60A5FA", "#A78BFA", "#F472B6"][i % 6],
      delay: `${(i * 0.085) % 2}s`,
      duration: `${2.8 + (i * 0.073) % 1.2}s`,
      size: `${8 + (i * 3) % 7}px`,
      borderRadius: i % 3 === 0 ? "50%" : "2px",
    }))
  );
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-50" aria-hidden="true">
      {pieces.current.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: p.left,
            top: "-16px",
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.borderRadius,
            animation: `confetti-fall ${p.duration} ${p.delay} ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
}
