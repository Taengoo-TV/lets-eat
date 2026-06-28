"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FRIENDS } from "@/lib/constants";

export default function Home() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const filtered = FRIENDS.filter(n => n.toLowerCase().includes(query.toLowerCase()));

  const pick = (name: string) => { setSelected(name); setQuery(name); setOpen(false); };

  const go = () => {
    localStorage.setItem("lets-eat-name", selected);
    router.push("/vote");
  };

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-5 bg-stone-50">
      <div className="flex flex-col items-center gap-6 w-full max-w-sm">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight text-stone-900">Let&apos;s Eat! 🍜</h1>
          <p className="mt-2 text-stone-500">Pick your name to get started</p>
        </div>

        <div
          className="relative w-full"
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}
        >
          <input
            type="text"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={e => { setQuery(e.target.value); setSelected(""); setOpen(true); }}
            placeholder="Search your name…"
            className="w-full px-4 py-3.5 rounded-xl border-2 border-stone-200 bg-white text-stone-900 outline-none focus:border-orange-500 transition-colors text-base"
          />
          {open && filtered.length > 0 && (
            <ul className="absolute z-10 top-full mt-1 w-full bg-white rounded-xl border border-stone-200 shadow-lg max-h-56 overflow-y-auto">
              {filtered.map(name => (
                <li
                  key={name}
                  onMouseDown={() => pick(name)}
                  className="px-4 py-3 cursor-pointer hover:bg-orange-50 text-stone-900"
                >
                  {name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected && (
          <button
            onClick={go}
            className="w-full py-3.5 rounded-xl text-white font-semibold text-base transition-opacity hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: "#E8593C" }}
          >
            Let&apos;s go →
          </button>
        )}
      </div>
    </main>
  );
}
