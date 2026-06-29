"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon, House, CalendarDots, ChartBar } from "@phosphor-icons/react";

export function Navbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-base font-bold tracking-tight text-foreground select-none">
            🍜 Let&apos;s Eat!
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
            >
              Dashboard
            </Link>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground w-9 h-9 flex items-center justify-center"
              aria-label="Toggle dark mode"
            >
              {mounted ? (theme === "dark" ? <Sun size={18} /> : <Moon size={18} />) : <span className="w-[18px] h-[18px]" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile bottom nav — hidden on sm+ */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/90 backdrop-blur-md sm:hidden">
        <div className="flex items-center justify-around h-14">
          <Link href="/" className="flex flex-col items-center gap-0.5 py-2 px-5 text-muted-foreground hover:text-foreground transition-colors min-w-[48px]">
            <House size={22} weight="regular" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link href="/vote" className="flex flex-col items-center gap-0.5 py-2 px-5 text-muted-foreground hover:text-foreground transition-colors min-w-[48px]">
            <CalendarDots size={22} weight="regular" />
            <span className="text-[10px] font-medium">Vote</span>
          </Link>
          <Link href="/dashboard" className="flex flex-col items-center gap-0.5 py-2 px-5 text-muted-foreground hover:text-foreground transition-colors min-w-[48px]">
            <ChartBar size={22} weight="regular" />
            <span className="text-[10px] font-medium">Results</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
