"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const TIME_ORDER = ["morning", "noon", "evening", "night"];

const TIME_META: Record<string, { label: string; sub: string }> = {
  morning: { label: "Morning", sub: "9-12" },
  noon:    { label: "Noon",    sub: "12-15" },
  evening: { label: "Evening", sub: "15-20" },
  night:   { label: "Night",   sub: "20+" },
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

  const [name, setName]             = useState("");
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);

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

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggle = (slotId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(slotId) ? next.delete(slotId) : next.add(slotId);
      return next;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    const { data: response, error: rErr } = await supabase
      .from("responses")
      .insert({ event_id: id, friend_name: name.trim() })
      .select("id")
      .single();

    if (rErr || !response) {
      setFormError("Failed to submit. Please try again.");
      setSubmitting(false);
      return;
    }

    if (selected.size > 0) {
      const rows = [...selected].map((slot_id) => ({ response_id: response.id, slot_id }));
      const { error: sErr } = await supabase.from("response_slots").insert(rows);
      if (sErr) {
        setFormError("Saved your name but failed to record slot choices.");
        setSubmitting(false);
        return;
      }
    }

    setSubmitted(true);
  };

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

  if (loading) return <Shell>Loading...</Shell>;
  if (!event)  return <Shell>Event not found.</Shell>;

  return (
    <>
      {showConfetti && <Confetti />}

      <div className="min-h-[100dvh] bg-stone-50">
        <nav className="px-5 py-4 flex items-center justify-between border-b border-stone-100 max-w-lg mx-auto">
          <Link href="/" className="font-bold text-stone-900 tracking-tight">
            Let&apos;s Eat!
          </Link>
          <button
            onClick={copyLink}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-all active:scale-[0.98] ${
              copied
                ? "bg-green-500 text-white"
                : "bg-orange-500 text-white hover:bg-orange-600"
            }`}
          >
            {copied ? "Copied!" : "Share link"}
          </button>
        </nav>

        <main className="max-w-lg mx-auto px-5 py-8 space-y-6">

          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight leading-tight">
              {event.title}
            </h1>
            <p className="text-sm text-stone-500">by {event.created_by}</p>
            {event.location_text && (
              <p className="text-sm text-stone-500">
                <span className="mr-1">&#128205;</span>{event.location_text}
              </p>
            )}
            {event.restaurant_types.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {event.restaurant_types.map((t) => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-200 font-medium">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Availability form */}
          <section className="bg-white border border-stone-200 rounded-2xl p-5 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-stone-900">Add your availability</h2>
              <p className="text-sm text-stone-500 mt-0.5">Mark when you can make it.</p>
            </div>

            {submitted ? (
              <div className="py-6 text-center space-y-2">
                <p className="text-4xl">&#127881;</p>
                <p className="text-sm font-semibold text-stone-900">You&apos;re in, {name}!</p>
                <p className="text-xs text-stone-400">Your availability has been recorded.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-stone-700 block">
                    Your name <span className="text-orange-500">*</span>
                  </label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jamie"
                    className="w-full border-2 border-stone-200 rounded-xl px-3.5 py-2.5 text-sm bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
                  />
                </div>

                {sortedDates.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-sm font-semibold text-stone-700">When are you free?</p>
                    {sortedDates.map((date) => {
                      const d = new Date(date + "T00:00:00");
                      return (
                        <div key={date}>
                          <p className="text-xs font-semibold text-stone-500 mb-2.5">
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
                                  className={`flex flex-col items-center justify-center min-h-14 rounded-2xl border-2 transition-all active:scale-[0.97] ${
                                    on
                                      ? "bg-green-500 border-green-500 text-white"
                                      : "bg-stone-50 border-stone-200 text-stone-700 hover:border-green-300"
                                  }`}
                                >
                                  <span className="text-sm font-semibold">{label}</span>
                                  <span className={`text-xs mt-0.5 ${on ? "text-green-100" : "text-stone-400"}`}>
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
                )}

                {formError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="w-full bg-orange-500 text-white py-3.5 rounded-full font-semibold text-base hover:bg-orange-600 disabled:opacity-40 active:scale-[0.98] transition-all"
                >
                  {submitting ? "Submitting..." : "Submit availability"}
                </button>
              </form>
            )}
          </section>

          {/* Results */}
          {eventSlots.length > 0 && (
            <section className="space-y-5">
              <div className="flex items-baseline gap-2">
                <h2 className="text-sm font-bold text-stone-700 uppercase tracking-wide">
                  Results
                </h2>
                <span className="text-xs text-stone-400">
                  {totalResponded} {totalResponded === 1 ? "response" : "responses"}, live
                </span>
              </div>

              <div className="space-y-6">
                {sortedDates.map((date) => {
                  const d = new Date(date + "T00:00:00");
                  return (
                    <div key={date}>
                      <p className="text-xs font-semibold text-stone-500 mb-3">
                        {d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                      </p>
                      <div className="space-y-2.5">
                        {byDate[date].map((slot) => {
                          const count = slotCount(slot.id);
                          const pct   = totalResponded > 0 ? (count / totalResponded) * 100 : 0;
                          const isTop = topSlotIds.has(slot.id);
                          const { label, sub } = TIME_META[slot.time_label];
                          return (
                            <div key={slot.id}>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className={`text-sm font-medium flex items-center gap-1.5 ${isTop ? "text-green-700" : "text-stone-700"}`}>
                                  {isTop && <span className="text-green-500 text-xs">&#9733;</span>}
                                  {label}
                                  <span className={`text-xs ${isTop ? "text-green-500" : "text-stone-400"}`}>{sub}</span>
                                </span>
                                <span className="text-xs tabular-nums text-stone-400 font-medium">
                                  {count}/{totalResponded}
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
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

          {/* Who's responded */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-stone-700 uppercase tracking-wide">
              Who&apos;s responded
            </h2>
            {responses.length === 0 ? (
              <p className="text-sm text-stone-400">
                No responses yet. Share this link!
              </p>
            ) : (
              <ul className="divide-y divide-stone-100">
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
                        <p className="text-sm font-semibold text-stone-900">{r.friend_name}</p>
                        {friendSlots.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {friendSlots.map((slot) => (
                              <span
                                key={slot.id}
                                className="text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium"
                              >
                                {new Date(slot.date + "T00:00:00").toLocaleDateString("en-US", {
                                  month: "short", day: "numeric",
                                })}
                                {" - "}
                                {TIME_META[slot.time_label].label}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-stone-400">No slots selected</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

        </main>
      </div>
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-stone-50 flex items-center justify-center">
      <p className="text-sm text-stone-400">{children}</p>
    </div>
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
