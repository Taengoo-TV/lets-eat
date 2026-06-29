"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DayPicker } from "react-day-picker";
import { supabase } from "@/lib/supabase";
import {
  TIME_SLOTS, TIME_SLOT_STYLES,
  PLACES, FOOD_TYPES,
  PLACE_CHIP, FOOD_CHIP,
} from "@/lib/constants";

function localDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function VotePage() {
  const [name, setName] = useState("");
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [timeSlots, setTimeSlots] = useState<Set<string>>(new Set());
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
      .select("selected_dates,selected_time_slots,preferred_places,preferred_food_types")
      .eq("friend_name", n)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          // Parse date strings back to noon-anchored Date objects (avoids UTC rollback)
          setSelectedDates(
            (data.selected_dates ?? []).map((s: string) => new Date(`${s}T12:00:00`))
          );
          setTimeSlots(new Set(data.selected_time_slots ?? []));
          setPlaces(new Set(data.preferred_places ?? []));
          setFoods(new Set(data.preferred_food_types ?? []));
        }
      });
  }, [router]);

  function toggle<T>(set: Set<T>, key: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setter(next);
  }

  const canSubmit = selectedDates.length > 0 && timeSlots.size > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    await supabase.from("votes").upsert(
      {
        friend_name: name,
        selected_dates: selectedDates.map(localDateKey),
        selected_time_slots: [...timeSlots],
        preferred_places: [...places],
        preferred_food_types: [...foods],
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "friend_name" },
    );
    router.push("/dashboard");
  };

  if (!name) return null;

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-28 space-y-8">
      <h1 className="text-2xl font-bold text-stone-900">
        Hey {name}! When are you free? 👋
      </h1>

      {/* Date picker */}
      <section className="space-y-3">
        <h2 className="font-semibold text-stone-700">
          Pick your free dates{" "}
          <span className="text-stone-400 font-normal text-sm">(tap to select)</span>
        </h2>
        <div className="bg-white rounded-2xl border border-stone-100 p-4 flex justify-center">
          <DayPicker
            mode="multiple"
            selected={selectedDates}
            onSelect={(dates) => setSelectedDates(dates ?? [])}
            startMonth={new Date()}
            modifiersStyles={{
              selected: {
                backgroundColor: "#E8593C",
                color: "white",
                borderRadius: "50%",
              },
            }}
          />
        </div>
        {selectedDates.length > 0 && (
          <p className="text-xs text-stone-500 text-center">
            {selectedDates.length} date{selectedDates.length !== 1 ? "s" : ""} selected
          </p>
        )}
      </section>

      {/* Time slot chips */}
      <section className="space-y-3">
        <h2 className="font-semibold text-stone-700">
          Which times work?{" "}
          <span className="text-stone-400 font-normal text-sm">(pick all that apply)</span>
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {TIME_SLOTS.map(slot => {
            const active = timeSlots.has(slot.key);
            const style = TIME_SLOT_STYLES[slot.key];
            return (
              <button
                key={slot.key}
                onClick={() => toggle(timeSlots, slot.key, setTimeSlots)}
                className="flex flex-col items-center gap-1 px-3 py-4 rounded-xl border-2 transition-colors text-center"
                style={{
                  backgroundColor: active ? style.bg : "white",
                  borderColor: active ? style.color : "#e7e5e4",
                  color: active ? style.color : "#57534e",
                }}
              >
                <span className="text-2xl">{slot.emoji}</span>
                <span className="font-semibold text-sm">{slot.key}</span>
                <span className="text-xs opacity-70 leading-tight">{slot.hours}</span>
              </button>
            );
          })}
        </div>
      </section>

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
                onClick={() => toggle(places, p, setPlaces)}
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
                onClick={() => toggle(foods, f, setFoods)}
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

      {/* Fixed submit button */}
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
          {(selectedDates.length === 0 || timeSlots.size === 0) && (
            <p className="text-center text-xs text-stone-400 mt-2">
              {selectedDates.length === 0
                ? "Select at least one date to continue"
                : "Select at least one time slot to continue"}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
