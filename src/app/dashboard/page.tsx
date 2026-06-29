"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, LabelList } from "recharts";
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
  date_time_slots: Record<string, string[]>;
  preferred_places: string[];
  preferred_food_types: string[];
};

type ViewMode = "byDate" | "byDateTime" | "calendar";
type ColorMode = "place" | "food";
type ChartEntry = Record<string, number | string>;

const NO_PREF = "No preference";
const GRAY = "#E5E7EB";

// Bar total = unique free friends per date; each friend counted once (their first preference)
function buildDateChart(
  votes: Vote[],
  colorMode: ColorMode,
  prefKeys: string[],
): ChartEntry[] {
  const dateSet = new Set<string>();
  for (const v of votes) for (const dk of Object.keys(v.date_time_slots)) dateSet.add(dk);

  return [...dateSet].sort().map(date => {
    const d = new Date(`${date}T12:00:00`);
    const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const entry: ChartEntry = { date: label, rawDate: date };
    for (const k of prefKeys) entry[k] = 0;

    let total = 0;
    for (const v of votes) {
      const slots = v.date_time_slots[date];
      if (!slots || slots.length === 0) continue;
      const prefs = colorMode === "place" ? v.preferred_places : v.preferred_food_types;
      const first = prefs[0] ?? NO_PREF;
      (entry[first] as number)++;
      total++;
    }
    entry.total = total;
    return entry;
  });
}

// Bar total = unique free friends per date×slot; separator entries between date groups
function buildDateTimeChart(
  votes: Vote[],
  colorMode: ColorMode,
  prefKeys: string[],
): { data: ChartEntry[]; separators: string[] } {
  const dateSet = new Set<string>();
  for (const v of votes) for (const dk of Object.keys(v.date_time_slots)) dateSet.add(dk);
  const sortedDates = [...dateSet].sort();

  const data: ChartEntry[] = [];
  const separators: string[] = [];

  sortedDates.forEach((date, i) => {
    if (i > 0) {
      const sepKey = `sep_${i}`;
      const sep: ChartEntry = { slot: sepKey };
      for (const k of prefKeys) sep[k] = 0;
      sep.total = 0;
      data.push(sep);
      separators.push(sepKey);
    }

    for (const time of ["Morning", "Afternoon", "Evening"]) {
      const entry: ChartEntry = { slot: `${date}_${time}` };
      for (const k of prefKeys) entry[k] = 0;

      let total = 0;
      for (const v of votes) {
        const slots = v.date_time_slots[date];
        if (!slots || !slots.includes(time)) continue;
        const prefs = colorMode === "place" ? v.preferred_places : v.preferred_food_types;
        const first = prefs[0] ?? NO_PREF;
        (entry[first] as number)++;
        total++;
      }
      entry.total = total;
      data.push(entry);
    }
  });

  return { data, separators };
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

function datePadKey(year: number, month: number, day: number) {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function totalLabel(chartData: ChartEntry[]) {
  return (props: any) => {
    const total = chartData[props.index ?? 0]?.total as number ?? 0;
    if (!total || props.x == null) return null;
    return (
      <text
        x={props.x + props.width / 2}
        y={props.y - 4}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="#374151"
      >
        {total}
      </text>
    );
  };
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
      .select("id,friend_name,date_time_slots,preferred_places,preferred_food_types");
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

  const prefKeys = colorMode === "place" ? [...PLACES, NO_PREF] : [...FOOD_TYPES, NO_PREF];
  const colorMap: Record<string, string> = colorMode === "place"
    ? { ...PLACE_COLORS, [NO_PREF]: GRAY }
    : { ...FOOD_COLORS, [NO_PREF]: GRAY };

  const respondedNames = new Set(votes.map(v => v.friend_name));
  const pending = FRIENDS.filter(f => !respondedNames.has(f));

  if (loading) {
    return <main className="text-center py-20 text-stone-400 text-sm">Loading…</main>;
  }

  const dateChartData = buildDateChart(votes, colorMode, prefKeys);
  const dateTimeData = buildDateTimeChart(votes, colorMode, prefKeys);

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

      {/* Stat card */}
      <div className="rounded-xl border border-stone-100 bg-white px-4 py-3 flex items-center gap-3">
        <span className="text-2xl font-bold text-stone-900">{votes.length}</span>
        <span className="text-sm text-stone-500">
          of {FRIENDS.length} friends have responded
        </span>
        {votes.length > 0 && (
          <span className="ml-auto text-xs text-stone-400">
            {FRIENDS.length - votes.length} pending
          </span>
        )}
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
              margin={{ bottom: 65, top: 20, left: 0, right: 8 }}
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
              {prefKeys.map((k, ki) => (
                <Bar key={k} dataKey={k} stackId="a" fill={colorMap[k]} name={k} isAnimationActive={false}>
                  {ki === prefKeys.length - 1 && (
                    <LabelList content={totalLabel(dateChartData) as any} />
                  )}
                </Bar>
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
              width={Math.max(640, dateTimeData.data.length * 58)}
              height={320}
              data={dateTimeData.data}
              margin={{ bottom: 45, top: 20, left: 0, right: 8 }}
            >
              {/* Slot row (Morning/Afternoon/Evening) */}
              <XAxis
                xAxisId={0}
                dataKey="slot"
                tick={{ fontSize: 9 }}
                interval={0}
                tickFormatter={(slot: string) => {
                  if (slot.startsWith("sep_")) return "";
                  return (slot.split("_").pop() ?? slot);
                }}
              />
              {/* Date row — label appears once centered under "Afternoon" slot */}
              <XAxis
                xAxisId={1}
                dataKey="slot"
                tick={{ fontSize: 10, fontWeight: 600, fill: "#374151" }}
                interval={0}
                axisLine={false}
                tickLine={false}
                tickFormatter={(slot: string) => {
                  if (!slot.includes("_Afternoon")) return "";
                  const date = slot.replace(/_Afternoon$/, "");
                  const d = new Date(`${date}T12:00:00`);
                  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                }}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(slot: any) => {
                  if (typeof slot !== "string" || slot.startsWith("sep_")) return "";
                  const parts = slot.split("_");
                  const time = parts.pop() ?? "";
                  const dateStr = parts.join("-");
                  const d = new Date(`${dateStr}T12:00:00`);
                  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${time}`;
                }}
              />
              {dateTimeData.separators.map(sepKey => (
                <ReferenceLine
                  key={sepKey}
                  x={sepKey}
                  xAxisId={0}
                  strokeDasharray="4 4"
                  stroke="#CBD5E1"
                />
              ))}
              {prefKeys.map((k, ki) => (
                <Bar key={k} dataKey={k} stackId="a" fill={colorMap[k]} name={k} xAxisId={0} isAnimationActive={false}>
                  {ki === prefKeys.length - 1 && (
                    <LabelList content={totalLabel(dateTimeData.data) as any} />
                  )}
                </Bar>
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
                const dk = datePadKey(calYear, calMonthIdx, day);
                const dayVotes = votes.filter(v => dk in v.date_time_slots && v.date_time_slots[dk].length > 0);
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
            const dayVotes = votes.filter(v => expandedDate in v.date_time_slots && v.date_time_slots[expandedDate].length > 0);
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
                      const timeSlots = v.date_time_slots[expandedDate] ?? [];
                      return (
                        <li key={v.id} className="flex flex-wrap items-start gap-2">
                          <FriendAvatar name={v.friend_name} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-stone-900">{v.friend_name}</p>
                            {timeSlots.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {timeSlots.map(t => (
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
                            {(v.preferred_places.length > 0 || v.preferred_food_types.length > 0) && (
                              <div className="flex flex-wrap gap-1 mt-1">
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
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Legend (chart modes only) — driven from same prefKeys+colorMap as bars */}
      {viewMode !== "calendar" && (
        <div className="flex flex-wrap gap-3">
          {prefKeys.map(k => (
            <div key={k} className="flex items-center gap-1.5 text-xs text-stone-600">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colorMap[k] }} />
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
          {votes.map(v => {
            const dateCount = Object.keys(v.date_time_slots).length;
            const allSlots = [...new Set(Object.values(v.date_time_slots).flat())];
            return (
              <li key={v.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3 flex items-start gap-3">
                <FriendAvatar name={v.friend_name} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-900">{v.friend_name}</p>
                  {dateCount > 0 && (
                    <p className="text-xs text-stone-400 mt-0.5">
                      {dateCount} date{dateCount !== 1 ? "s" : ""}
                      {allSlots.length > 0 && <> · {allSlots.join(", ")}</>}
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
            );
          })}
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
