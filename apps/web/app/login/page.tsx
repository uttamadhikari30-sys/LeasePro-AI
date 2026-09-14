"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fafafa] px-4 py-16">
      {/* Ambient background: amortization curve + soft gradient wash */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-edme-blue/[0.06] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] translate-x-1/4 translate-y-1/4 rounded-full bg-edme-red/[0.05] blur-3xl" />
        <svg
          className="absolute bottom-0 left-0 h-[45%] w-full opacity-[0.5]"
          viewBox="0 0 1200 300"
          preserveAspectRatio="none"
          fill="none"
        >
          <defs>
            <linearGradient id="curveLine" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1c3687" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#ed1b2f" stopOpacity="0.10" />
            </linearGradient>
          </defs>
          <path
            d="M0,60 C120,55 180,90 260,100 C360,112 420,150 520,160 C620,170 680,205 780,215 C880,225 950,250 1050,258 C1110,262 1160,268 1200,270"
            stroke="url(#curveLine)"
            strokeWidth="2"
            className="curve-draw"
          />
          <path
            d="M0,60 C120,55 180,90 260,100 C360,112 420,150 520,160 C620,170 680,205 780,215 C880,225 950,250 1050,258 C1110,262 1160,268 1200,270 L1200,300 L0,300 Z"
            fill="url(#curveLine)"
            opacity="0.35"
          />
        </svg>
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, #0f172a 1px, transparent 0)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(ellipse 60% 50% at 50% 0%, black 0%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse 60% 50% at 50% 0%, black 0%, transparent 70%)",
            opacity: 0.03,
          }}
        />
      </div>

      <div className="relative w-full max-w-[380px]">
        <div className="mb-9 flex flex-col items-center text-center">
          <img src="/edme-logo.svg" alt="edme" className="h-8" />
          <div className="mt-6 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
            <span>Ind AS 116</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>IFRS 16</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>AI-Powered</span>
          </div>
          <h1 className="mt-4 text-[1.75rem] font-semibold leading-tight tracking-tight text-slate-900">
            Sign in to LeasePro AI
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-[28px] border border-slate-200/80 bg-white/80 p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_48px_-16px_rgba(15,23,42,0.14)] backdrop-blur-xl"
        >
          <div>
            <Label htmlFor="email" className="text-xs font-medium text-slate-500">
              Email
            </Label>
            <div className="relative mt-1.5">
              <svg viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400">
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
                className="h-11 rounded-xl border-slate-200 bg-slate-50/60 pl-10 focus-visible:bg-white"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password" className="text-xs font-medium text-slate-500">
              Password
            </Label>
            <div className="relative mt-1.5">
              <svg viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400">
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
                className="h-11 rounded-xl border-slate-200 bg-slate-50/60 pl-10 pr-10 focus-visible:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
            <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
              <svg viewBox="0 0 20 20" fill="none" className="mt-0.5 h-3.5 w-3.5 shrink-0">
                <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M10 6.5v4M10 13.2h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="group relative h-11 w-full overflow-hidden rounded-xl bg-linear-to-b from-edme-red to-edme-red-2 text-[13px] font-semibold tracking-wide text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_10px_24px_-8px_rgba(237,27,47,0.55)] transition-all hover:shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_14px_28px_-8px_rgba(237,27,47,0.65)] hover:brightness-105 active:brightness-95"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/15 to-transparent"
            />
            {loading ? (
              <>
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 animate-spin">
                  <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
                  <path d="M18 10a8 8 0 0 0-8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                Signing in…
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-[13px] text-slate-400">
          Accounts are created by your organization admin — there is no public signup.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4 text-[11px] font-medium text-slate-300">
          <span>Edme Insurance Brokers Limited</span>
          <span className="h-1 w-1 rounded-full bg-slate-200" />
          <span>256-bit encryption</span>
        </div>
      </div>

      <style>{`
        .curve-draw {
          stroke-dasharray: 1800;
          stroke-dashoffset: 1800;
          animation: draw-curve 1.8s cubic-bezier(0.22, 1, 0.36, 1) forwards 0.15s;
        }
        @keyframes draw-curve {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}
