"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MagnifyingGlass, CaretDown, ArrowRight } from "@phosphor-icons/react";
import { FRIENDS } from "@/lib/constants";

export default function Home() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const filtered = FRIENDS.filter(n => n.toLowerCase().includes(query.toLowerCase()));

  const pick = (name: string) => { setSelected(name); setQuery(name); setOpen(false); };

  const go = () => {
    if (!selected) return;
    localStorage.setItem("lets-eat-name", selected);
    router.push("/vote");
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-[calc(100dvh-3.5rem)] px-5 bg-background">
      <motion.div
        className="flex flex-col items-center gap-8 w-full max-w-sm"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Hero */}
        <div className="text-center space-y-3">
          <motion.div
            className="text-6xl mb-1"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            🍜
          </motion.div>
          <h1 className="text-5xl font-bold tracking-tight leading-none">
            <span className="bg-gradient-to-br from-[#E8593C] via-[#ef7c3a] to-[#F59E0B] bg-clip-text text-transparent">
              Let&apos;s Eat!
            </span>
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Find when everyone&apos;s free<br />to eat together.
          </p>
        </div>

        {/* Name picker */}
        <div
          className="relative w-full"
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}
        >
          <div
            className="w-full px-4 py-3.5 rounded-xl border-2 border-border bg-card text-foreground flex items-center gap-2 cursor-text focus-within:border-[#E8593C] transition-colors"
          >
            <MagnifyingGlass size={18} className="text-muted-foreground shrink-0" />
            <input
              type="text"
              value={query}
              onFocus={() => setOpen(true)}
              onChange={e => { setQuery(e.target.value); setSelected(""); setOpen(true); }}
              placeholder="Search your name…"
              className="flex-1 outline-none bg-transparent text-base placeholder:text-muted-foreground text-foreground"
            />
            <CaretDown
              size={16}
              className={`text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </div>

          <AnimatePresence>
            {open && filtered.length > 0 && !(selected && query === selected) && (
              <motion.ul
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute z-10 top-full mt-1.5 w-full bg-card rounded-xl border border-border shadow-xl max-h-56 overflow-y-auto"
              >
                {filtered.map(name => (
                  <li
                    key={name}
                    onMouseDown={(e) => { e.preventDefault(); pick(name); }}
                    className="px-4 py-3 cursor-pointer hover:bg-muted text-foreground text-sm transition-colors first:rounded-t-xl last:rounded-b-xl"
                  >
                    {name}
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          {selected && (
            <motion.div
              className="w-full"
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.button
                onClick={go}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="w-full py-4 rounded-xl text-white font-semibold text-base flex items-center justify-center gap-2 shadow-sm"
                style={{ backgroundColor: "#E8593C" }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                Let&apos;s go, {selected}
                <ArrowRight size={18} weight="bold" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}
