"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { supabase } from "@/lib/supabase";
import { FRIENDS, PLACES, FOOD_TYPES, PLACE_COLORS, FOOD_COLORS } from "@/lib/constants";

type Vote = {
  id: string;
  friend_name: string;
  time_slots: string[];
  preferred_places: string[];
  preferred_food_types: string[];
};

function localDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function allSlots(): string[] {
  const today = new Date();
  const timeKeys = ["morning", "noon", "evening", "night"];
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dk = localDateKey(d);
    for (const t of timeKeys) out.push(`${dk}_${t}`);
  }
  return out;
}

function slotLabel(key: string) {
  const [dateStr, time] = key.split("_");
  // Parse as local date — append T12:00:00 to avoid UTC midnight rollback
  const d = new Date(`${dateStr}T12:00:00`);
  const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
  const timeLabel: Record<string, string> = { morning: "AM", noon: "Noon", evening: "Eve", night: "Night" };
  return `${dayLabel} ${timeLabel[time] ?? time}`;
}

// Y-axis = "preference mentions per slot": a person who is free at a slot contributes 1
// to each place/food they selected. Bars can exceed unique-respondent count when people
// have multiple preferences — this is intentional (shows preference spread per slot).
function buildChart(votes: Vote[], mode: "place" | "food") {
  const keys = mode === "place" ? [...PLACES] : [...FOOD_TYPES];
  return allSlots().map(slot => {
    const counts: Record<string, number> = Object.fromEntries(keys.map(k => [k, 0]));
    for (const v of votes) {
      if (!v.time_slots.includes(slot)) continue;
      const prefs = mode === "place" ? v.preferred_places : v.preferred_food_types;
      for (const p of prefs) { if (p in counts) counts[p]++; }
    }
    return { slot: slotLabel(slot), rawSlot: slot, ...counts };
  });
}

export default function DashboardPage() {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [mode, setMode] = useState<"place" | "food">("place");
  const [loading, setLoading] = useState(true);

  const fetchVotes = useCallback(async () => {
    const { data } = await supabase
      .from("votes")
      .select("id,friend_name,time_slots,preferred_places,preferred_food_types");
    setVotes((data as Vote[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchVotes();
    const ch = supabase
      .channel("votes-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, fetchVotes)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchVotes]);

  const colors = mode === "place" ? PLACE_COLORS : FOOD_COLORS;
  const keys = mode === "place" ? [...PLACES] : [...FOOD_TYPES];
  const chartData = buildChart(votes, mode);
  const respondedNames = new Set(votes.map(v => v.friend_name));
  const pending = FRIENDS.filter(f => !respondedNames.has(f));

  if (loading) {
    return <main className="text-center py-20 text-stone-400 text-sm">Loading…</main>;
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-stone-900">Let&apos;s Eat! — Who&apos;s free when?</h1>
        <Link
          href="/vote"
          className="shrink-0 px-4 py-2 rounded-full text-sm font-medium border-2 border-stone-200 text-stone-600 hover:bg-stone-100 transition-colors"
        >
          Change my vote
        </Link>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-stone-500">View by:</span>
        {(["place", "food"] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: mode === m ? "#E8593C" : "#f5f5f4",
              color: mode === m ? "white" : "#57534e",
            }}
          >
            {m === "place" ? "Place" : "Food type"}
          </button>
        ))}
      </div>

      {/* Stacked bar chart */}
      <div className="overflow-x-auto rounded-2xl border border-stone-100 bg-white p-4">
        {votes.length === 0 ? (
          <p className="text-center text-stone-400 text-sm py-12">No votes yet — be the first!</p>
        ) : (
          <BarChart
            width={Math.max(680, chartData.length * 62)}
            height={280}
            data={chartData}
            margin={{ bottom: 65, top: 8, left: 0, right: 8 }}
          >
            <XAxis
              dataKey="slot"
              angle={-45}
              textAnchor="end"
              tick={{ fontSize: 10 }}
              interval={0}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
            <Tooltip />
            {keys.map(k => (
              <Bar key={k} dataKey={k} stackId="a" fill={colors[k]} name={k} />
            ))}
          </BarChart>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {keys.map(k => (
          <div key={k} className="flex items-center gap-1.5 text-xs text-stone-600">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colors[k] }} />
            {k}
          </div>
        ))}
      </div>

      {/* Friend list */}
      <section className="space-y-3">
        <h2 className="font-semibold text-stone-900">
          Responses <span className="text-stone-400 font-normal">({votes.length}/{FRIENDS.length})</span>
        </h2>
        <ul className="space-y-2">
          {votes.map(v => (
            <li key={v.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3">
              <p className="font-medium text-stone-900">{v.friend_name}</p>
              {v.time_slots.length > 0 && (
                <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                  {v.time_slots.map(s => slotLabel(s)).join(" · ")}
                </p>
              )}
            </li>
          ))}
          {pending.map(f => (
            <li key={f} className="rounded-xl border border-stone-100 px-4 py-3 text-stone-400 text-sm">
              {f}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
