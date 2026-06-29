"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
type ColorMode = "people" | "place" | "food";
type ChartEntry = Record<string, number | string>;

const NO_PREF = "No preference";
const GRAY = "#94A3B8";

function allDates(votes: Vote[]): string[] {
  const s = new Set<string>();
  for (const v of votes) for (const dk of Object.keys(v.date_time_slots)) s.add(dk);
  return [...s].sort();
}

function fillEntry(entry: ChartEntry, freeVotes: Vote[], colorMode: ColorMode, prefKeys: string[]) {
  for (const k of prefKeys) entry[k] = 0;
  let total = 0;
  for (const v of freeVotes) {
    total++;
    if (colorMode === "people") {
      entry[v.friend_name] = 1;
    } else {
      const prefs = colorMode === "place" ? v.preferred_places : v.preferred_food_types;
      if (prefs.length === 0) {
        (entry[NO_PREF] as number) += 1;
      } else {
        const share = 1 / prefs.length;
        for (const p of prefs) {
          if (p in entry) (entry[p] as number) += share;
        }
      }
    }
  }
  entry.total = total;
}

function buildDateChart(votes: Vote[], colorMode: ColorMode, prefKeys: string[]): ChartEntry[] {
  return allDates(votes).map(date => {
    const d = new Date(`${date}T12:00:00`);
    const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const entry: ChartEntry = { date: label, rawDate: date };
    const free = votes.filter(v => { const s = v.date_time_slots[date]; return s && s.length > 0; });
    fillEntry(entry, free, colorMode, prefKeys);
    return entry;
  });
}

function buildDateTimeChart(votes: Vote[], colorMode: ColorMode, prefKeys: string[]): { data: ChartEntry[]; separators: string[] } {
  const sortedDates = allDates(votes);
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
      const free = votes.filter(v => { const s = v.date_time_slots[date]; return s && s.includes(time); });
      fillEntry(entry, free, colorMode, prefKeys);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (props: any) => {
    const total = chartData[props.index ?? 0]?.total as number ?? 0;
    if (!total || props.x == null) return null;
    return (
      <text x={props.x + props.width / 2} y={props.y - 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--foreground)">
        {total}
      </text>
    );
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PeopleTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const free: string[] = (payload as any[]).filter(p => (p.value ?? 0) > 0).map((p: any) => p.name);
  if (!free.length) return null;
  const displayLabel = (() => {
    const l = String(label ?? "");
    if (/^\d{4}-\d{2}-\d{2}_/.test(l)) {
      const parts = l.split("_");
      const time = parts.pop() ?? "";
      const d = new Date(`${parts.join("-")}T12:00:00`);
      return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${time}`;
    }
    return l;
  })();
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-md max-w-[200px]">
      <p className="font-semibold text-foreground mb-1">{displayLabel}</p>
      <p className="text-muted-foreground leading-relaxed">{free.join(", ")}</p>
    </div>
  );
}

function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    prev.current = target;
    if (start === target) return;
    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + (target - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return count;
}

export default function DashboardPage() {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("byDate");
  const [colorMode, setColorMode] = useState<ColorMode>("people");
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

  const prefKeys: string[] = colorMode === "people"
    ? ([...FRIENDS] as string[])
    : colorMode === "place" ? [...PLACES, NO_PREF] : [...FOOD_TYPES, NO_PREF];

  const colorMap: Record<string, string> = colorMode === "people"
    ? Object.fromEntries(FRIENDS.map(f => [f, friendBg(f)]))
    : colorMode === "place"
      ? { ...PLACE_COLORS, [NO_PREF]: GRAY }
      : { ...FOOD_COLORS, [NO_PREF]: GRAY };

  const respondedNames = new Set(votes.map(v => v.friend_name));
  const pending = FRIENDS.filter(f => !respondedNames.has(f));
  const countUp = useCountUp(votes.length);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  const dateChartData = buildDateChart(votes, colorMode, prefKeys);
  const dateTimeData = buildDateTimeChart(votes, colorMode, prefKeys);

  const calYear = calMonth.getFullYear();
  const calMonthIdx = calMonth.getMonth();
  const calRows = calendarGrid(calYear, calMonthIdx);
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const prefTooltip = (
    <Tooltip
      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter={(value: any) =>
        typeof value === "number" && value % 1 !== 0 ? value.toFixed(1) : value
      }
    />
  );

  function bars(chartData: ChartEntry[], xAxisId?: number) {
    return prefKeys.map((k, ki) => (
      <Bar
        key={k}
        dataKey={k}
        stackId="a"
        fill={colorMap[k]}
        name={k}
        animationDuration={800}
        {...(xAxisId != null ? { xAxisId } : {})}
      >
        {ki === prefKeys.length - 1 && (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <LabelList content={totalLabel(chartData) as any} />
        )}
      </Bar>
    ));
  }

  const VIEW_TABS: { value: ViewMode; label: string }[] = [
    { value: "byDate", label: "By Date" },
    { value: "byDateTime", label: "By Date & Time" },
    { value: "calendar", label: "Calendar" },
  ];

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Stat card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="bg-card rounded-2xl border border-border p-6 flex items-center gap-4 shadow-sm"
      >
        <div>
          <span className="text-4xl font-bold text-foreground tabular-nums">{countUp}</span>
          <span className="text-muted-foreground text-sm"> / {FRIENDS.length}</span>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground text-sm">Friends responded</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {FRIENDS.length - votes.length} still pending
          </p>
        </div>
        <Link
          href="/vote"
          className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          Edit vote
        </Link>
      </motion.div>

      {/* View mode tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {VIEW_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setViewMode(tab.value)}
            className="relative px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
            style={{
              color: viewMode === tab.value ? "var(--foreground)" : "var(--muted-foreground)",
            }}
          >
            {viewMode === tab.value && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-0 bg-card rounded-lg shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Stack by toggle — chart modes only */}
      {viewMode !== "calendar" && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Stack by:</span>
          {(["people", "place", "food"] as const).map(m => (
            <button
              key={m}
              onClick={() => setColorMode(m)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all border"
              style={{
                backgroundColor: colorMode === m ? "#E8593C" : "transparent",
                borderColor: colorMode === m ? "#E8593C" : "var(--border)",
                color: colorMode === m ? "white" : "var(--muted-foreground)",
              }}
            >
              {m === "people" ? "People" : m === "place" ? "Place" : "Food type"}
            </button>
          ))}
        </div>
      )}

      {/* By Date chart */}
      <AnimatePresence mode="wait">
        {viewMode === "byDate" && (
          <motion.div
            key="byDate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-x-auto rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            {votes.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-12">No votes yet — be the first!</p>
            ) : (
              <BarChart
                width={Math.max(640, dateChartData.length * 90)}
                height={280}
                data={dateChartData}
                margin={{ bottom: 65, top: 20, left: 0, right: 8 }}
              >
                <XAxis dataKey="date" angle={-40} textAnchor="end" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={28} />
                {colorMode === "people"
                  ? <Tooltip content={<PeopleTooltip />} />
                  : prefTooltip}
                {bars(dateChartData)}
              </BarChart>
            )}
          </motion.div>
        )}

        {/* By Date & Time chart */}
        {viewMode === "byDateTime" && (
          <motion.div
            key="byDateTime"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-x-auto rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            {votes.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-12">No votes yet — be the first!</p>
            ) : (
              <BarChart
                width={Math.max(640, dateTimeData.data.length * 58)}
                height={320}
                data={dateTimeData.data}
                margin={{ bottom: 45, top: 20, left: 0, right: 8 }}
              >
                <XAxis
                  xAxisId={0}
                  dataKey="slot"
                  tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  interval={0}
                  tickFormatter={(slot: string) => {
                    if (slot.startsWith("sep_")) return "";
                    return slot.split("_").pop() ?? slot;
                  }}
                />
                <XAxis
                  xAxisId={1}
                  dataKey="slot"
                  tick={{ fontSize: 10, fontWeight: 600, fill: "var(--foreground)" }}
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
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={28} />
                {colorMode === "people"
                  ? <Tooltip content={<PeopleTooltip />} />
                  : (
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) =>
                        typeof value === "number" && value % 1 !== 0 ? value.toFixed(1) : value
                      }
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
                  )}
                {dateTimeData.separators.map(sepKey => (
                  <ReferenceLine key={sepKey} x={sepKey} xAxisId={0} strokeDasharray="4 4" stroke="var(--border)" />
                ))}
                {bars(dateTimeData.data, 0)}
              </BarChart>
            )}
          </motion.div>
        )}

        {/* Calendar view */}
        {viewMode === "calendar" && (
          <motion.div
            key="calendar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border border-border bg-card p-4 space-y-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCalMonth(new Date(calYear, calMonthIdx - 1))}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                ←
              </button>
              <span className="font-semibold text-foreground">
                {calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
              <button
                onClick={() => setCalMonth(new Date(calYear, calMonthIdx + 1))}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                →
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {DOW.map(d => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>

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
                      className="min-h-[70px] p-1.5 rounded-lg border cursor-pointer transition-all"
                      style={{
                        borderColor: isExpanded ? "#E8593C" : dayVotes.length > 0 ? "var(--border)" : "transparent",
                        backgroundColor: isExpanded ? "#FEF0EC" : dayVotes.length > 0 ? "var(--muted)" : "transparent",
                      }}
                    >
                      <p className="text-xs font-medium text-muted-foreground mb-1">{day}</p>
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
                          <span className="inline-block text-[9px] text-muted-foreground px-0.5 py-0.5">
                            +{dayVotes.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            <AnimatePresence>
              {expandedDate && (() => {
                const dayVotes = votes.filter(v => expandedDate in v.date_time_slots && v.date_time_slots[expandedDate].length > 0);
                const d = new Date(`${expandedDate}T12:00:00`);
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.2 }}
                    className="mt-2 p-4 rounded-xl border border-[#E8593C]/30 bg-accent space-y-3"
                  >
                    <h3 className="font-semibold text-foreground">
                      {d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {dayVotes.length} friend{dayVotes.length !== 1 ? "s" : ""} free
                      </span>
                    </h3>
                    {dayVotes.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No one selected this date</p>
                    ) : (
                      <ul className="space-y-2">
                        {dayVotes.map(v => {
                          const timeSlots = v.date_time_slots[expandedDate] ?? [];
                          return (
                            <li key={v.id} className="flex flex-wrap items-start gap-2">
                              <FriendAvatar name={v.friend_name} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">{v.friend_name}</p>
                                {timeSlots.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {timeSlots.map(t => (
                                      <span
                                        key={t}
                                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                                        style={{ backgroundColor: TIME_SLOT_STYLES[t]?.bg ?? "#f5f5f4", color: TIME_SLOT_STYLES[t]?.color ?? "#57534e" }}
                                      >
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {(v.preferred_places.length > 0 || v.preferred_food_types.length > 0) && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {v.preferred_places.map(p => (
                                      <span key={p} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: PLACE_CHIP[p]?.bg ?? "#f5f5f4", color: PLACE_CHIP[p]?.color ?? "#57534e" }}>
                                        {p}
                                      </span>
                                    ))}
                                    {v.preferred_food_types.map(f => (
                                      <span key={f} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: FOOD_CHIP[f]?.bg ?? "#f5f5f4", color: FOOD_CHIP[f]?.color ?? "#57534e" }}>
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
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      {viewMode !== "calendar" && (
        <div className="flex flex-wrap gap-3">
          {colorMode === "people"
            ? votes.map(v => (
                <div key={v.friend_name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: friendBg(v.friend_name) }} />
                  {v.friend_name}
                </div>
              ))
            : prefKeys.map(k => (
                <div key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colorMap[k] }} />
                  {k}
                </div>
              ))}
        </div>
      )}

      {/* Friend list */}
      <section className="space-y-3">
        <h2 className="font-semibold text-foreground">
          Responses{" "}
          <span className="text-muted-foreground font-normal">({votes.length}/{FRIENDS.length})</span>
        </h2>
        <ul className="space-y-2">
          {votes.map(v => {
            const dateCount = Object.keys(v.date_time_slots).length;
            const allSlots = [...new Set(Object.values(v.date_time_slots).flat())];
            return (
              <li key={v.id} className="rounded-xl border border-border bg-card px-4 py-3 flex items-start gap-3 shadow-sm">
                <FriendAvatar name={v.friend_name} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{v.friend_name}</p>
                  {dateCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {dateCount} date{dateCount !== 1 ? "s" : ""}
                      {allSlots.length > 0 && <> · {allSlots.join(", ")}</>}
                    </p>
                  )}
                  {(v.preferred_places.length > 0 || v.preferred_food_types.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {v.preferred_places.map(p => (
                        <span key={p} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: PLACE_CHIP[p]?.bg ?? "#f5f5f4", color: PLACE_CHIP[p]?.color ?? "#57534e" }}>
                          {p}
                        </span>
                      ))}
                      {v.preferred_food_types.map(f => (
                        <span key={f} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: FOOD_CHIP[f]?.bg ?? "#f5f5f4", color: FOOD_CHIP[f]?.color ?? "#57534e" }}>
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
            <li key={f} className="rounded-xl border border-border px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                {f.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-muted-foreground text-sm">{f}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
