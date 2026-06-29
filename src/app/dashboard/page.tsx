"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { supabase } from "@/lib/supabase";
import {
  FRIENDS, PLACES, FOOD_TYPES,
  PLACE_COLORS, FOOD_COLORS,
  PLACE_CHIP, FOOD_CHIP,
  TIME_SLOT_STYLES,
  friendBg,
} from "@/lib/constants";

type Vote = {
  id: string;
  friend_name: string;
  selected_dates: string[];
  selected_time_slots: string[];
  preferred_places: string[];
  preferred_food_types: string[];
};

type ViewMode = "byDate" | "byDateTime" | "calendar";
type ColorMode = "place" | "food";

// Build stacked bar data grouped by date
function buildDateChart(votes: Vote[], colorMode: ColorMode) {
  const dateSet = new Set<string>();
  for (const v of votes) for (const d of v.selected_dates) dateSet.add(d);
  const prefKeys = colorMode === "place" ? [...PLACES] : [...FOOD_TYPES];
  return [...dateSet].sort().map(date => {
    const d = new Date(`${date}T12:00:00`);
    const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const counts: Record<string, number | string> = { date: label, rawDate: date };
    for (const k of prefKeys) counts[k] = 0;
    for (const v of votes) {
      if (!v.selected_dates.includes(date)) continue;
      const prefs = colorMode === "place" ? v.preferred_places : v.preferred_food_types;
      for (const p of prefs) { if (p in counts) (counts[p] as number)++; }
    }
    return counts;
  });
}

// Build stacked bar data grouped by date × time slot
function buildDateTimeChart(votes: Vote[], colorMode: ColorMode) {
  const dateSet = new Set<string>();
  for (const v of votes) for (const d of v.selected_dates) dateSet.add(d);
  const prefKeys = colorMode === "place" ? [...PLACES] : [...FOOD_TYPES];
  const data: Record<string, number | string>[] = [];
  for (const date of [...dateSet].sort()) {
    const d = new Date(`${date}T12:00:00`);
    const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    for (const time of ["Morning", "Afternoon", "Evening"]) {
      const counts: Record<string, number | string> = {
        slot: `${dateLabel} ${time.slice(0, 3)}`,
      };
      for (const k of prefKeys) counts[k] = 0;
      for (const v of votes) {
        if (!v.selected_dates.includes(date)) continue;
        if (!v.selected_time_slots.includes(time)) continue;
        const prefs = colorMode === "place" ? v.preferred_places : v.preferred_food_types;
        for (const p of prefs) { if (p in counts) (counts[p] as number)++; }
      }
      data.push(counts);
    }
  }
  return data;
}

function calendarGrid(year: number, month: number): (number | null)[][] {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rows: (number | null)[][] = [];
  let row: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    row.push(d);
    if (row.length === 7) { rows.push(row); row = []; }
  }
  if (row.length > 0) {
    while (row.length < 7) row.push(null);
    rows.push(row);
  }
  return rows;
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function FriendAvatar({ name }: { name: string }) {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
      style={{ backgroundColor: friendBg(name), color: "#374151" }}
      title={name}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function DashboardPage() {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("byDate");
  const [colorMode, setColorMode] = useState<ColorMode>("place");
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const fetchVotes = useCallback(async () => {
    const { data } = await supabase
      .from("votes")
      .select("id,friend_name,selected_dates,selected_time_slots,preferred_places,preferred_food_types");
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

  const colors = colorMode === "place" ? PLACE_COLORS : FOOD_COLORS;
  const prefKeys = colorMode === "place" ? [...PLACES] : [...FOOD_TYPES];
  const respondedNames = new Set(votes.map(v => v.friend_name));
  const pending = FRIENDS.filter(f => !respondedNames.has(f));

  if (loading) {
    return <main className="text-center py-20 text-stone-400 text-sm">Loading…</main>;
  }

  // ── Chart data ──────────────────────────────────────────────
  const dateChartData = buildDateChart(votes, colorMode);
  const dateTimeChartData = buildDateTimeChart(votes, colorMode);

  // ── Calendar ─────────────────────────────────────────────────
  const calYear = calMonth.getFullYear();
  const calMonthIdx = calMonth.getMonth();
  const calRows = calendarGrid(calYear, calMonthIdx);
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
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

      {/* View mode toggle */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {([
          ["byDate", "By Date"],
          ["byDateTime", "By Date & Time"],
          ["calendar", "Calendar view"],
        ] as const).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setViewMode(m)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: viewMode === m ? "#1c1917" : "#f5f5f4",
              color: viewMode === m ? "white" : "#57534e",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Color mode toggle — only for chart views */}
      {viewMode !== "calendar" && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-stone-500">Stack by:</span>
          {(["place", "food"] as const).map(m => (
            <button
              key={m}
              onClick={() => setColorMode(m)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: colorMode === m ? "#E8593C" : "#f5f5f4",
                color: colorMode === m ? "white" : "#57534e",
              }}
            >
              {m === "place" ? "Place" : "Food type"}
            </button>
          ))}
        </div>
      )}

      {/* ── Mode 1: By Date ─────────────────────────────────── */}
      {viewMode === "byDate" && (
        <div className="overflow-x-auto rounded-2xl border border-stone-100 bg-white p-4">
          {votes.length === 0 ? (
            <p className="text-center text-stone-400 text-sm py-12">No votes yet — be the first!</p>
          ) : (
            <BarChart
              width={Math.max(640, dateChartData.length * 90)}
              height={280}
              data={dateChartData}
              margin={{ bottom: 65, top: 8, left: 0, right: 8 }}
            >
              <XAxis
                dataKey="date"
                angle={-40}
                textAnchor="end"
                tick={{ fontSize: 10 }}
                interval={0}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
              <Tooltip />
              {prefKeys.map(k => (
                <Bar key={k} dataKey={k} stackId="a" fill={colors[k]} name={k} />
              ))}
            </BarChart>
          )}
        </div>
      )}

      {/* ── Mode 2: By Date & Time ──────────────────────────── */}
      {viewMode === "byDateTime" && (
        <div className="overflow-x-auto rounded-2xl border border-stone-100 bg-white p-4">
          {votes.length === 0 ? (
            <p className="text-center text-stone-400 text-sm py-12">No votes yet — be the first!</p>
          ) : (
            <BarChart
              width={Math.max(640, dateTimeChartData.length * 58)}
              height={280}
              data={dateTimeChartData}
              margin={{ bottom: 70, top: 8, left: 0, right: 8 }}
            >
              <XAxis
                dataKey="slot"
                angle={-45}
                textAnchor="end"
                tick={{ fontSize: 9 }}
                interval={0}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
              <Tooltip />
              {prefKeys.map(k => (
                <Bar key={k} dataKey={k} stackId="a" fill={colors[k]} name={k} />
              ))}
            </BarChart>
          )}
        </div>
      )}

      {/* ── Mode 3: Calendar view ───────────────────────────── */}
      {viewMode === "calendar" && (
        <div className="rounded-2xl border border-stone-100 bg-white p-4 space-y-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCalMonth(new Date(calYear, calMonthIdx - 1))}
              className="p-2 rounded-lg hover:bg-stone-100 text-stone-600 transition-colors"
            >
              ←
            </button>
            <span className="font-semibold text-stone-900">
              {calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <button
              onClick={() => setCalMonth(new Date(calYear, calMonthIdx + 1))}
              className="p-2 rounded-lg hover:bg-stone-100 text-stone-600 transition-colors"
            >
              →
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1">
            {DOW.map(d => (
              <div key={d} className="text-center text-xs font-medium text-stone-400 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {calRows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-7 gap-1">
              {row.map((day, ci) => {
                if (!day) return <div key={ci} className="min-h-[70px]" />;
                const dk = dateKey(calYear, calMonthIdx, day);
                const dayVotes = votes.filter(v => v.selected_dates.includes(dk));
                const isExpanded = expandedDate === dk;
                return (
                  <div
                    key={ci}
                    onClick={() => setExpandedDate(isExpanded ? null : dk)}
                    className="min-h-[70px] p-1.5 rounded-lg border cursor-pointer transition-colors"
                    style={{
                      borderColor: isExpanded ? "#E8593C" : dayVotes.length > 0 ? "#e7e5e4" : "#f5f5f4",
                      backgroundColor: isExpanded ? "#FFF7F5" : dayVotes.length > 0 ? "white" : "#fafaf9",
                    }}
                  >
                    <p className="text-xs font-medium text-stone-500 mb-1">{day}</p>
                    <div className="flex flex-wrap gap-0.5">
                      {dayVotes.slice(0, 4).map(v => (
                        <span
                          key={v.id}
                          className="inline-block text-[9px] font-semibold px-1 py-0.5 rounded-full"
                          style={{ backgroundColor: friendBg(v.friend_name), color: "#374151" }}
                          title={v.friend_name}
                        >
                          {v.friend_name.slice(0, 3)}
                        </span>
                      ))}
                      {dayVotes.length > 4 && (
                        <span className="inline-block text-[9px] text-stone-400 px-0.5 py-0.5">
                          +{dayVotes.length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Expanded date detail */}
          {expandedDate && (() => {
            const dayVotes = votes.filter(v => v.selected_dates.includes(expandedDate));
            const d = new Date(`${expandedDate}T12:00:00`);
            return (
              <div className="mt-2 p-4 rounded-xl border border-orange-200 bg-orange-50 space-y-3">
                <h3 className="font-semibold text-stone-900">
                  {d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  <span className="ml-2 text-sm font-normal text-stone-500">
                    {dayVotes.length} friend{dayVotes.length !== 1 ? "s" : ""} free
                  </span>
                </h3>
                {dayVotes.length === 0 ? (
                  <p className="text-stone-400 text-sm">No one selected this date</p>
                ) : (
                  <ul className="space-y-2">
                    {dayVotes.map(v => {
                      const placeChips = v.preferred_places;
                      const foodChips = v.preferred_food_types;
                      return (
                        <li key={v.id} className="flex flex-wrap items-start gap-2">
                          <FriendAvatar name={v.friend_name} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-stone-900">{v.friend_name}</p>
                            {v.selected_time_slots.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {v.selected_time_slots.map(t => (
                                  <span
                                    key={t}
                                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                                    style={{
                                      backgroundColor: TIME_SLOT_STYLES[t]?.bg ?? "#f5f5f4",
                                      color: TIME_SLOT_STYLES[t]?.color ?? "#57534e",
                                    }}
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                            {(placeChips.length > 0 || foodChips.length > 0) && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {placeChips.map(p => (
                                  <span
                                    key={p}
                                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                                    style={{
                                      backgroundColor: PLACE_CHIP[p]?.bg ?? "#f5f5f4",
                                      color: PLACE_CHIP[p]?.color ?? "#57534e",
                                    }}
                                  >
                                    {p}
                                  </span>
                                ))}
                                {foodChips.map(f => (
                                  <span
                                    key={f}
                                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                                    style={{
                                      backgroundColor: FOOD_CHIP[f]?.bg ?? "#f5f5f4",
                                      color: FOOD_CHIP[f]?.color ?? "#57534e",
                                    }}
                                  >
                                    {f}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Legend (chart modes only) */}
      {viewMode !== "calendar" && (
        <div className="flex flex-wrap gap-3">
          {prefKeys.map(k => (
            <div key={k} className="flex items-center gap-1.5 text-xs text-stone-600">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colors[k] }} />
              {k}
            </div>
          ))}
        </div>
      )}

      {/* Friend list */}
      <section className="space-y-3">
        <h2 className="font-semibold text-stone-900">
          Responses{" "}
          <span className="text-stone-400 font-normal">({votes.length}/{FRIENDS.length})</span>
        </h2>
        <ul className="space-y-2">
          {votes.map(v => (
            <li key={v.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3 flex items-start gap-3">
              <FriendAvatar name={v.friend_name} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-900">{v.friend_name}</p>
                {v.selected_dates.length > 0 && (
                  <p className="text-xs text-stone-400 mt-0.5">
                    {v.selected_dates.length} date{v.selected_dates.length !== 1 ? "s" : ""}
                    {v.selected_time_slots.length > 0 && (
                      <> · {v.selected_time_slots.join(", ")}</>
                    )}
                  </p>
                )}
                {(v.preferred_places.length > 0 || v.preferred_food_types.length > 0) && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {v.preferred_places.map(p => (
                      <span
                        key={p}
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: PLACE_CHIP[p]?.bg ?? "#f5f5f4",
                          color: PLACE_CHIP[p]?.color ?? "#57534e",
                        }}
                      >
                        {p}
                      </span>
                    ))}
                    {v.preferred_food_types.map(f => (
                      <span
                        key={f}
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: FOOD_CHIP[f]?.bg ?? "#f5f5f4",
                          color: FOOD_CHIP[f]?.color ?? "#57534e",
                        }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
          {pending.map(f => (
            <li key={f} className="rounded-xl border border-stone-100 px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-400">
                {f.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-stone-400 text-sm">{f}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
