"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DayPicker } from "react-day-picker";
import { supabase } from "@/lib/supabase";
import { TIME_SLOTS, TIME_SLOT_STYLES, PLACES, FOOD_TYPES, PLACE_CHIP, FOOD_CHIP } from "@/lib/constants";

function localDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function VotePage() {
  const [name, setName] = useState("");
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  // { "2026-06-30": ["Morning", "Evening"], ... }
  const [dateTimeSlots, setDateTimeSlots] = useState<Record<string, string[]>>({});
  const [places, setPlaces] = useState<Set<string>>(new Set());
  const [foods, setFoods] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const n = localStorage.getItem("lets-eat-name") ?? "";
    if (!n) { router.replace("/"); return; }
    setName(n);
    supabase
      .from("votes")
      .select("date_time_slots,preferred_places,preferred_food_types")
      .eq("friend_name", n)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const map = (data.date_time_slots ?? {}) as Record<string, string[]>;
          const dates = Object.keys(map).map(s => new Date(`${s}T12:00:00`));
          setSelectedDates(dates);
          setDateTimeSlots(map);
          setPlaces(new Set(data.preferred_places ?? []));
          setFoods(new Set(data.preferred_food_types ?? []));
        }
      });
  }, [router]);

  const handleDatesChange = (dates: Date[] | undefined) => {
    const next = dates ?? [];
    setSelectedDates(next);
    // Preserve existing slot selections; prune removed dates
    setDateTimeSlots(prev => {
      const updated: Record<string, string[]> = {};
      for (const d of next) {
        const key = localDateKey(d);
        updated[key] = prev[key] ?? [];
      }
      return updated;
    });
  };

  const toggleTimeSlot = (dateKey: string, slot: string) => {
    setDateTimeSlots(prev => {
      const current = prev[dateKey] ?? [];
      const next = current.includes(slot)
        ? current.filter(s => s !== slot)
        : [...current, slot];
      return { ...prev, [dateKey]: next };
    });
  };

  function toggleSet<T>(set: Set<T>, key: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setter(next);
  }

  const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
  const hasAnySlot = Object.values(dateTimeSlots).some(s => s.length > 0);
  const canSubmit = selectedDates.length > 0 && hasAnySlot && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    // Only persist dates that have at least one slot selected
    const filtered: Record<string, string[]> = {};
    for (const [date, slots] of Object.entries(dateTimeSlots)) {
      if (slots.length > 0) filtered[date] = slots;
    }
    await supabase.from("votes").upsert(
      {
        friend_name: name,
        date_time_slots: filtered,
        preferred_places: [...places],
        preferred_food_types: [...foods],
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "friend_name" },
    );
    router.push("/dashboard");
  };

  if (!name) return null;

  const today = new Date();

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-28 space-y-8">
      <h1 className="text-2xl font-bold text-stone-900">
        Hey {name}! When are you free? 👋
      </h1>

      {/* Calendar */}
      <section className="space-y-3">
        <h2 className="font-semibold text-stone-700">
          Pick your free dates{" "}
          <span className="text-stone-400 font-normal text-sm">(tap to select)</span>
        </h2>
        <div className="bg-white rounded-2xl border border-stone-100 p-4 flex justify-center">
          <DayPicker
            mode="multiple"
            selected={selectedDates}
            onSelect={handleDatesChange}
            startMonth={today}
            disabled={{ before: today }}
            modifiersStyles={{
              selected: { backgroundColor: "#E8593C", color: "white", borderRadius: "50%" },
              disabled: { color: "#d4d4d4" },
            }}
          />
        </div>
        {selectedDates.length > 0 && (
          <p className="text-xs text-stone-500 text-center">
            {selectedDates.length} date{selectedDates.length !== 1 ? "s" : ""} selected
          </p>
        )}
      </section>

      {/* Per-date time slot selection */}
      {sortedDates.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-semibold text-stone-700">
            Which times work for each date?{" "}
            <span className="text-stone-400 font-normal text-sm">(select per day)</span>
          </h2>
          {sortedDates.map(date => {
            const dk = localDateKey(date);
            const selected = dateTimeSlots[dk] ?? [];
            const dayLabel = date.toLocaleDateString("en-US", {
              weekday: "long", month: "short", day: "numeric",
            });
            return (
              <div key={dk} className="bg-white rounded-xl border border-stone-100 p-4 space-y-3">
                <p className="text-sm font-semibold text-stone-700">📅 {dayLabel}</p>
                <div className="grid grid-cols-3 gap-2">
                  {TIME_SLOTS.map(slot => {
                    const active = selected.includes(slot.key);
                    const style = TIME_SLOT_STYLES[slot.key];
                    return (
                      <button
                        key={slot.key}
                        onClick={() => toggleTimeSlot(dk, slot.key)}
                        className="flex flex-col items-center gap-0.5 px-2 py-3 rounded-xl border-2 transition-colors text-center"
                        style={{
                          backgroundColor: active ? style.bg : "white",
                          borderColor: active ? style.color : "#e7e5e4",
                          color: active ? style.color : "#57534e",
                        }}
                      >
                        <span className="text-xl">{slot.emoji}</span>
                        <span className="font-semibold text-xs">{slot.key}</span>
                        <span className="text-xs opacity-70 leading-tight">{slot.hours}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Preferred places */}
      <section className="space-y-3">
        <h2 className="font-semibold text-stone-700">
          Preferred place{" "}
          <span className="text-stone-400 font-normal text-sm">(pick all that work)</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {PLACES.map(p => {
            const active = places.has(p);
            const chip = PLACE_CHIP[p];
            return (
              <button
                key={p}
                onClick={() => toggleSet(places, p, setPlaces)}
                className="px-4 py-2 rounded-full border-2 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: active ? chip.bg : "white",
                  borderColor: active ? chip.color : "#e7e5e4",
                  color: active ? chip.color : "#57534e",
                }}
              >
                {p}
              </button>
            );
          })}
        </div>
      </section>

      {/* Restaurant type */}
      <section className="space-y-3">
        <h2 className="font-semibold text-stone-700">
          Restaurant type{" "}
          <span className="text-stone-400 font-normal text-sm">(pick all that work)</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {FOOD_TYPES.map(f => {
            const active = foods.has(f);
            const chip = FOOD_CHIP[f];
            return (
              <button
                key={f}
                onClick={() => toggleSet(foods, f, setFoods)}
                className="px-4 py-2 rounded-full border-2 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: active ? chip.bg : "white",
                  borderColor: active ? chip.color : "#e7e5e4",
                  color: active ? chip.color : "#57534e",
                }}
              >
                {f}
              </button>
            );
          })}
        </div>
      </section>

      {/* Fixed submit */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-stone-50/90 backdrop-blur border-t border-stone-100">
        <div className="max-w-lg mx-auto">
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="w-full py-3.5 rounded-xl text-white font-semibold text-base disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#E8593C" }}
          >
            {submitting ? "Saving…" : "Submit"}
          </button>
          {(!selectedDates.length || !hasAnySlot) && (
            <p className="text-center text-xs text-stone-400 mt-2">
              {!selectedDates.length
                ? "Select at least one date to continue"
                : "Select at least one time slot per date to continue"}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
