"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { TIME_SLOTS, PLACES, FOOD_TYPES } from "@/lib/constants";

function localDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function getDates(): Date[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
}

const DATES = getDates();

export default function VotePage() {
  const [name, setName] = useState("");
  const [slots, setSlots] = useState<Set<string>>(new Set());
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
      .select("time_slots,preferred_places,preferred_food_types")
      .eq("friend_name", n)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSlots(new Set(data.time_slots));
          setPlaces(new Set(data.preferred_places));
          setFoods(new Set(data.preferred_food_types));
        }
      });
  }, [router]);

  function toggle<T>(set: Set<T>, key: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setter(next);
  }

  const submit = async () => {
    if (slots.size === 0 || submitting) return;
    setSubmitting(true);
    await supabase.from("votes").upsert(
      {
        friend_name: name,
        time_slots: [...slots],
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

      {/* Date + time slot grid */}
      <section className="space-y-5">
        <h2 className="font-semibold text-stone-700">Pick your free slots</h2>
        {DATES.map(date => (
          <div key={localDateKey(date)}>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
              {fmtDate(date)}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {TIME_SLOTS.map(slot => {
                const key = `${localDateKey(date)}_${slot.key}`;
                const active = slots.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggle(slots, key, setSlots)}
                    className="flex flex-col items-start px-4 py-3 rounded-xl border-2 transition-colors text-left min-h-[56px]"
                    style={{
                      borderColor: active ? "#E8593C" : "#e7e5e4",
                      backgroundColor: active ? "#E8593C" : "white",
                      color: active ? "white" : "#292524",
                    }}
                  >
                    <span className="font-semibold text-sm">{slot.label}</span>
                    <span className="text-xs opacity-70">{slot.hours}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Preferred places */}
      <section className="space-y-3">
        <h2 className="font-semibold text-stone-700">Preferred place <span className="text-stone-400 font-normal text-sm">(pick all that work)</span></h2>
        <div className="flex flex-wrap gap-2">
          {PLACES.map(p => {
            const active = places.has(p);
            return (
              <button
                key={p}
                onClick={() => toggle(places, p, setPlaces)}
                className="px-4 py-2 rounded-full border-2 text-sm font-medium transition-colors"
                style={{
                  borderColor: active ? "#E8593C" : "#e7e5e4",
                  backgroundColor: active ? "#E8593C" : "white",
                  color: active ? "white" : "#292524",
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
        <h2 className="font-semibold text-stone-700">Restaurant type <span className="text-stone-400 font-normal text-sm">(pick all that work)</span></h2>
        <div className="flex flex-wrap gap-2">
          {FOOD_TYPES.map(f => {
            const active = foods.has(f);
            return (
              <button
                key={f}
                onClick={() => toggle(foods, f, setFoods)}
                className="px-4 py-2 rounded-full border-2 text-sm font-medium transition-colors"
                style={{
                  borderColor: active ? "#E8593C" : "#e7e5e4",
                  backgroundColor: active ? "#E8593C" : "white",
                  color: active ? "white" : "#292524",
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
            disabled={submitting || slots.size === 0}
            className="w-full py-3.5 rounded-xl text-white font-semibold text-base disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#E8593C" }}
          >
            {submitting ? "Saving…" : "Submit"}
          </button>
          {slots.size === 0 && (
            <p className="text-center text-xs text-stone-400 mt-2">Select at least one time slot to continue</p>
          )}
        </div>
      </div>
    </main>
  );
}
