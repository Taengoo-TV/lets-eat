"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
    <main className="max-w-lg mx-auto px-4 pt-8 pb-44 sm:pb-32 space-y-8">
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="text-2xl font-bold text-foreground">
          Hey {name}! 👋
        </h1>
        <p className="text-muted-foreground mt-1">When are you free to eat?</p>
      </motion.div>

      {/* Calendar */}
      <motion.section
        className="space-y-3"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2 className="font-semibold text-foreground">
          Pick your free dates{" "}
          <span className="text-muted-foreground font-normal text-sm">tap to select</span>
        </h2>
        <div className="bg-card rounded-2xl border border-border p-4 flex justify-center shadow-sm">
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
          <p className="text-xs text-muted-foreground text-center">
            {selectedDates.length} date{selectedDates.length !== 1 ? "s" : ""} selected
          </p>
        )}
      </motion.section>

      {/* Per-date time slot selection */}
      <AnimatePresence>
        {sortedDates.length > 0 && (
          <motion.section
            className="space-y-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="font-semibold text-foreground">
              Which times work?{" "}
              <span className="text-muted-foreground font-normal text-sm">select per day</span>
            </h2>
            {sortedDates.map((date, idx) => {
              const dk = localDateKey(date);
              const selected = dateTimeSlots[dk] ?? [];
              const dayLabel = date.toLocaleDateString("en-US", {
                weekday: "long", month: "short", day: "numeric",
              });
              return (
                <motion.div
                  key={dk}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.3, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-card rounded-xl border border-border p-4 space-y-3 shadow-sm"
                >
                  <p className="text-sm font-semibold text-foreground">📅 {dayLabel}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {TIME_SLOTS.map(slot => {
                      const active = selected.includes(slot.key);
                      const style = TIME_SLOT_STYLES[slot.key];
                      return (
                        <button
                          key={slot.key}
                          onClick={() => toggleTimeSlot(dk, slot.key)}
                          className="flex flex-col items-center gap-1 px-2 py-4 rounded-xl border-2 transition-all text-center min-h-[56px]"
                          style={{
                            backgroundColor: active ? style.bg : "transparent",
                            borderColor: active ? style.color : "var(--border)",
                            color: active ? style.color : "var(--muted-foreground)",
                          }}
                        >
                          <span className="text-xl">{slot.emoji}</span>
                          <span className="font-semibold text-xs">{slot.key}</span>
                          <span className="text-[10px] opacity-70 leading-tight">{slot.hours}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Preferred places */}
      <motion.section
        className="space-y-3"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2 className="font-semibold text-foreground">
          Preferred place{" "}
          <span className="text-muted-foreground font-normal text-sm">pick all that work</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {PLACES.map(p => {
            const active = places.has(p);
            const chip = PLACE_CHIP[p];
            return (
              <button
                key={p}
                onClick={() => toggleSet(places, p, setPlaces)}
                className="px-4 py-2.5 rounded-full border-2 text-sm font-medium transition-all min-h-[40px]"
                style={{
                  backgroundColor: active ? chip.bg : "transparent",
                  borderColor: active ? chip.color : "var(--border)",
                  color: active ? chip.color : "var(--muted-foreground)",
                }}
              >
                {p}
              </button>
            );
          })}
        </div>
      </motion.section>

      {/* Restaurant type */}
      <motion.section
        className="space-y-3"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2 className="font-semibold text-foreground">
          Restaurant type{" "}
          <span className="text-muted-foreground font-normal text-sm">pick all that work</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {FOOD_TYPES.map(f => {
            const active = foods.has(f);
            const chip = FOOD_CHIP[f];
            return (
              <button
                key={f}
                onClick={() => toggleSet(foods, f, setFoods)}
                className="px-4 py-2.5 rounded-full border-2 text-sm font-medium transition-all min-h-[40px]"
                style={{
                  backgroundColor: active ? chip.bg : "transparent",
                  borderColor: active ? chip.color : "var(--border)",
                  color: active ? chip.color : "var(--muted-foreground)",
                }}
              >
                {f}
              </button>
            );
          })}
        </div>
      </motion.section>

      {/* Fixed submit — sits above mobile bottom nav */}
      <div className="fixed bottom-14 sm:bottom-0 left-0 right-0 p-4 bg-background/90 backdrop-blur-md border-t border-border z-30">
        <div className="max-w-lg mx-auto">
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="w-full py-4 rounded-xl text-white font-semibold text-base disabled:opacity-40 transition-all hover:opacity-90 active:scale-[0.99] shadow-sm"
            style={{ backgroundColor: "#E8593C" }}
          >
            {submitting ? "Saving…" : "Submit availability"}
          </button>
          {(!selectedDates.length || !hasAnySlot) && (
            <p className="text-center text-xs text-muted-foreground mt-2">
              {!selectedDates.length
                ? "Select at least one date to continue"
                : "Select at least one time slot per date"}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
