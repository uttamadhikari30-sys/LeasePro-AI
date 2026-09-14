"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

const FEATURES = [
  {
    title: "Ind AS 116 & IFRS 16, done right",
    desc: "Full effective-interest liability amortization, ROU depreciation, and remeasurement — not a spreadsheet approximation.",
  },
  {
    title: "AI contract reader",
    desc: "Upload a lease agreement and let AI pre-fill the terms — dates, rent, escalation, deposits — in seconds.",
  },
  {
    title: "Audit-ready from day one",
    desc: "Every calculation, journal, and change is traced end to end with a full audit trail.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    try {
      await api.get("/organizations/me");
      router.push("/dashboard");
    } catch {
      router.push("/onboarding");
    } finally {
      setLoading(false);
      router.refresh();
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: brand panel */}
      <div className="relative hidden overflow-hidden bg-linear-to-br from-edme-blue-deep via-edme-blue-2 to-edme-blue lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full bg-edme-red/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-white/10 blur-3xl"
        />

        <div className="relative z-10">
          <img src="/edme-logo.svg" alt="edme" className="h-9 brightness-0 invert" />
        </div>

        <div className="relative z-10 max-w-md">
          <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white/90 backdrop-blur-sm">
            LEASE ACCOUNTING, POWERED BY AI
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-white">
            LeasePro AI
          </h1>
          <p className="mt-3 text-base text-white/70">
            Smart lease accounting for Ind AS 116 &amp; IFRS 16 — built for finance teams who
            don&apos;t have time for spreadsheets at year-end.
          </p>

          <ul className="mt-10 space-y-6">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5 text-white">
                    <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" fill="currentColor" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="mt-0.5 text-sm text-white/60">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 text-xs text-white/50">
          <p className="font-medium text-white/70">Edme Insurance Brokers Limited</p>
          <p className="mt-1">VIOS Tower, 6th Floor, Off Eastern Express Highway, Sewri – Chembur Rd, Mumbai 400037</p>
          <p className="mt-3">© 2026 Edme. All rights reserved.</p>
        </div>
      </div>

      {/* Right: sign-in form */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:hidden">
            <img src="/edme-logo.svg" alt="edme" className="mx-auto mb-4 h-9" />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-500">
              Sign in to your organization&apos;s LeasePro AI workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-7 shadow-lg shadow-slate-200/50">
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1.5">
                <svg viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400">
                  <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h11A1.5 1.5 0 0 1 17 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5v-9Z" stroke="currentColor" strokeWidth="1.3" />
                  <path d="m4 5.5 6 5 6-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@edmeinsurance.com"
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <div className="relative mt-1.5">
                <svg viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400">
                  <rect x="4" y="8.5" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M6.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                      <path d="M3 3l14 14M9.9 5.1a5 5 0 0 1 5.6 3M4.5 8.2A5 5 0 0 0 4 10s2.5 4.5 6 4.5c.8 0 1.5-.15 2.2-.4M7.3 12.7a2 2 0 0 1-.3-1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                      <path d="M4 10s2.5-4.5 6-4.5S16 10 16 10s-2.5 4.5-6 4.5S4 10 4 10Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <svg viewBox="0 0 20 20" fill="none" className="mt-0.5 h-4 w-4 shrink-0">
                  <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M10 6.5v4M10 13.2h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? (
                <>
                  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 animate-spin">
                    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
                    <path d="M18 10a8 8 0 0 0-8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Accounts are created by your organization admin — there is no public signup.
          </p>
        </div>
      </div>
    </div>
  );
}
