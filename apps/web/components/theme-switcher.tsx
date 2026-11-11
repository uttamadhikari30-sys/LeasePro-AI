"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";

type Theme = { id: string; name: string; swatch: [string, string, string] };

const THEMES: Theme[] = [
  { id: "classic", name: "Edme Classic", swatch: ["#0d1733", "#243a80", "#e0384a"] },
  { id: "graphite", name: "Graphite", swatch: ["#1b2436", "#3a4c6e", "#d05a5a"] },
  { id: "petrol", name: "Petrol", swatch: ["#0c2f3c", "#136073", "#e06a52"] },
  { id: "forest", name: "Forest", swatch: ["#143528", "#25604c", "#d08841"] },
  { id: "aubergine", name: "Aubergine", swatch: ["#2c1a40", "#5a3175", "#d85a95"] },
  { id: "bordeaux", name: "Bordeaux", swatch: ["#3a1420", "#78243d", "#c99a4a"] },
];

function applyTheme(id: string) {
  if (id === "classic") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", id);
  try { localStorage.setItem("lp-theme", id); } catch { /* ignore */ }
}

export function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("classic");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setActive(localStorage.getItem("lp-theme") || "classic"); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function choose(id: string) {
    setActive(id);
    applyTheme(id);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-edme-blue/40 hover:text-edme-blue"
        aria-label="Change theme"
        title="Change theme"
      >
        <Palette className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Theme</p>
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => choose(t.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${active === t.id ? "bg-slate-100" : "hover:bg-slate-50"}`}
            >
              <span className="flex overflow-hidden rounded-md shadow-sm ring-1 ring-black/5">
                {t.swatch.map((c) => <span key={c} className="h-5 w-3.5" style={{ backgroundColor: c }} />)}
              </span>
              <span className="flex-1 text-left font-medium text-slate-700">{t.name}</span>
              {active === t.id && <Check className="h-4 w-4 text-edme-blue" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
