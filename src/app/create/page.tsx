"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { supabase } from "@/lib/supabase";

const TIME_SLOTS = [
  { value: "morning", label: "Morning", sub: "9–12" },
  { value: "noon", label: "Noon", sub: "12–15" },
  { value: "evening", label: "Evening", sub: "15–20" },
  { value: "night", label: "Night", sub: "20+" },
];

const RESTAURANT_TYPES = [
  "Thai", "Japanese", "Korean", "Hotpot", "BBQ", "Café", "Italian", "Other",
];

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CreatePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [yourName, setYourName] = useState("");
  const [dates, setDates] = useState<Date[]>([]);
  const [slots, setSlots] = useState<Record<string, string[]>>({});
  const [location, setLocation] = useState("");
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSlot = (dateKey: string, slot: string) =>
    setSlots((prev) => {
      const cur = prev[dateKey] ?? [];
      return {
        ...prev,
        [dateKey]: cur.includes(slot) ? cur.filter((s) => s !== slot) : [...cur, slot],
      };
    });

  const toggleCuisine = (c: string) =>
    setCuisines((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data: event, error: eventErr } = await supabase
      .from("events")
      .insert({
        title,
        created_by: yourName.trim() || "Organiser",
        location_text: location,
        restaurant_types: cuisines,
      })
      .select("id, creator_token")
      .single();

    if (eventErr || !event) {
      setError("Failed to create event. Check your Supabase connection.");
      setSubmitting(false);
      return;
    }

    const slotRows = dates.flatMap((date) => {
      const key = toDateKey(date);
      return (slots[key] ?? []).map((time_label) => ({
        event_id: event.id,
        date: key,
        time_label,
      }));
    });

    if (slotRows.length > 0) {
      const { error: slotsErr } = await supabase.from("event_slots").insert(slotRows);
      if (slotsErr) {
        setError("Event created but failed to save time slots.");
        setSubmitting(false);
        return;
      }
    }

    localStorage.setItem(`creator_token_${event.id}`, event.creator_token);
    router.push(`/event/${event.id}`);
  };

  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());

  return (
    <main className="max-w-lg mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Plan a meal</h1>
        <p className="text-sm text-gray-500 mt-1">
          Fill in the details and share the link with your group.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <Field label="Event title" required>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Friday night dinner"
            className={input}
          />
        </Field>

        {/* Your name */}
        <Field label="Your name">
          <input
            value={yourName}
            onChange={(e) => setYourName(e.target.value)}
            placeholder="Alex"
            className={input}
          />
        </Field>

        {/* Date picker */}
        <Field label="Pick dates" required>
          <div className="border border-gray-200 rounded-xl w-fit overflow-hidden">
            <DayPicker
              mode="multiple"
              selected={dates}
              onSelect={(d) => setDates(d ?? [])}
              disabled={{ before: new Date() }}
            />
          </div>
          {dates.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">{dates.length} date{dates.length > 1 ? "s" : ""} selected</p>
          )}
        </Field>

        {/* Time slots per date */}
        {sortedDates.length > 0 && (
          <Field label="Time slots">
            <div className="space-y-4">
              {sortedDates.map((date) => {
                const key = toDateKey(date);
                const active = slots[key] ?? [];
                return (
                  <div key={key}>
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {TIME_SLOTS.map(({ value, label, sub }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => toggleSlot(key, value)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                            active.includes(value)
                              ? "bg-orange-500 text-white border-orange-500"
                              : "bg-white text-gray-700 border-gray-300 hover:border-orange-300"
                          }`}
                        >
                          {label} <span className="text-xs opacity-70">{sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Field>
        )}

        {/* Location */}
        <Field label="Location / area">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Sukhumvit, Bangkok"
            className={input}
          />
        </Field>

        {/* Restaurant types */}
        <Field label="Restaurant type">
          <div className="flex flex-wrap gap-2">
            {RESTAURANT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => toggleCuisine(type)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  cuisines.includes(type)
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-gray-700 border-gray-300 hover:border-orange-300"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </Field>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !title || dates.length === 0}
          className="w-full bg-orange-500 text-white py-2.5 rounded-xl font-medium hover:bg-orange-600 disabled:opacity-40 transition-colors"
        >
          {submitting ? "Creating…" : "Create event →"}
        </button>
      </form>
    </main>
  );
}

const input =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-orange-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
