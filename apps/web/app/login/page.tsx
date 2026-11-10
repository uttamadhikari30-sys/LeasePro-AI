"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

const CSS = `
.edme-login{
  --navy:#0b1b5e; --blue:#1c3687; --blue2:#15287a; --red:#ed1b2f; --red2:#c81528;
  --ink:#0e1830; --muted:#5b6b8c; --glass:rgba(255,255,255,.62); --glass-brd:rgba(255,255,255,.75);
  position:fixed; inset:0; overflow:hidden; color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased;
}
.edme-login .serif{font-family:Georgia,"Times New Roman",ui-serif,serif;}
.edme-login .stage{position:absolute;inset:0;overflow:hidden;background:
  radial-gradient(1200px 800px at 12% 18%,#dfe7fb 0%,rgba(223,231,251,0) 60%),
  radial-gradient(1000px 900px at 88% 82%,#f6e2e6 0%,rgba(246,226,230,0) 55%),
  linear-gradient(135deg,#eef2fb 0%,#e7edfa 48%,#f2f4fb 100%);}
.edme-login .orb{position:absolute;border-radius:50%;filter:blur(60px);opacity:.55;mix-blend-mode:multiply;animation:el-float 18s ease-in-out infinite;}
.edme-login .orb.b1{width:520px;height:520px;left:-120px;top:-120px;background:radial-gradient(circle at 30% 30%,#9db4f2,#1c3687);}
.edme-login .orb.b2{width:460px;height:460px;right:-100px;bottom:-120px;background:radial-gradient(circle at 60% 40%,#f3a0ab,#ed1b2f);animation-delay:-6s;opacity:.42}
.edme-login .orb.b3{width:360px;height:360px;left:48%;top:58%;background:radial-gradient(circle at 50% 50%,#bcd0ff,#15287a);animation-delay:-11s;opacity:.4}
@keyframes el-float{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(40px,-30px) scale(1.06)}66%{transform:translate(-30px,25px) scale(.96)}}
.edme-login .gridbg{position:absolute;inset:0;background-image:linear-gradient(rgba(28,54,135,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(28,54,135,.05) 1px,transparent 1px);background-size:46px 46px;-webkit-mask-image:radial-gradient(circle at 50% 40%,#000 0%,transparent 75%);mask-image:radial-gradient(circle at 50% 40%,#000 0%,transparent 75%);}
.edme-login .ribbons{position:absolute;inset:0;width:100%;height:100%}
.edme-login .ribbons path{fill:none;stroke-width:2;stroke-linecap:round;opacity:.5;stroke-dasharray:1400;stroke-dashoffset:1400;animation:el-draw 3s cubic-bezier(.22,1,.36,1) forwards;}
.edme-login .ribbons path:nth-child(2){animation-delay:.25s}
.edme-login .ribbons path:nth-child(3){animation-delay:.5s}
.edme-login .ribbons path:nth-child(4){animation-delay:.75s}
@keyframes el-draw{to{stroke-dashoffset:0}}
.edme-login .wrap{position:relative;z-index:2;display:grid;grid-template-columns:1.05fr .95fr;height:100%;overflow:auto}
.edme-login .pitch{display:flex;flex-direction:column;justify-content:center;gap:26px;padding:7vh 6vw;}
.edme-login .brandline{display:inline-flex;align-items:center;gap:12px;font-size:11px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--blue);}
.edme-login .brandline .dash{width:34px;height:2px;background:linear-gradient(90deg,var(--blue),var(--red));border-radius:2px}
.edme-login .brandline .byco{font-weight:600;letter-spacing:.1em;color:var(--muted)}
.edme-login .pitch h1{margin:0;font-weight:600;font-size:clamp(40px,5vw,64px);line-height:1.03;letter-spacing:-.01em;color:var(--navy);}
.edme-login .pitch h1 em{font-style:italic;background:linear-gradient(92deg,#0e1f4d 0%,#1c3687 50%,#b3122a 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.edme-login .pitch p{margin:0;max-width:34ch;font-size:16px;line-height:1.65;color:var(--muted)}
.edme-login .feats{display:flex;flex-direction:column;gap:14px;margin-top:6px}
.edme-login .feat{display:flex;gap:12px;align-items:flex-start}
.edme-login .feat .ic{flex:0 0 34px;height:34px;border-radius:11px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--blue),var(--navy));box-shadow:0 8px 18px -8px rgba(28,54,135,.6)}
.edme-login .feat strong{display:block;font-size:13.5px;color:var(--ink);font-weight:650}
.edme-login .feat span{font-size:13px;color:var(--muted)}
.edme-login .auth{display:flex;align-items:center;justify-content:center;padding:5vh 5vw;}
.edme-login .card{position:relative;width:100%;max-width:438px;padding:34px 34px 30px;border-radius:26px;background:var(--glass);backdrop-filter:blur(26px) saturate(140%);-webkit-backdrop-filter:blur(26px) saturate(140%);border:1px solid var(--glass-brd);box-shadow:0 1px 0 rgba(255,255,255,.7) inset,0 30px 70px -28px rgba(11,27,94,.45),0 10px 24px -18px rgba(11,27,94,.3);animation:el-rise .9s cubic-bezier(.22,1,.36,1) both;}
@keyframes el-rise{from{opacity:0;transform:translateY(16px) scale(.985)}to{opacity:1;transform:none}}
.edme-login .card::before{content:"";position:absolute;inset:0;border-radius:26px;padding:1px;background:linear-gradient(120deg,rgba(28,54,135,.5),rgba(237,27,47,.4),rgba(255,255,255,0));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:.7;pointer-events:none}
.edme-login .logo{height:30px;display:block;margin-bottom:22px}
.edme-login .seal{position:absolute;top:26px;right:26px;width:46px;height:46px;border-radius:50%;background:conic-gradient(from 0deg,var(--blue),var(--red),var(--blue));padding:2px;animation:el-spin 14s linear infinite;opacity:.9}
.edme-login .seal i{width:100%;height:100%;border-radius:50%;background:rgba(255,255,255,.9);display:grid;place-items:center;font-size:8px;font-weight:800;letter-spacing:.06em;color:var(--blue);font-style:normal;text-align:center;line-height:1.1}
@keyframes el-spin{to{transform:rotate(360deg)}}
.edme-login .kicker{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--red);margin-bottom:8px}
.edme-login .card h2{margin:0 0 4px;font-weight:600;font-size:30px;letter-spacing:-.01em;color:var(--navy)}
.edme-login .card .subt{margin:0 0 22px;font-size:13.5px;color:var(--muted)}
.edme-login .field{margin-bottom:14px}
.edme-login .field label{display:block;font-size:11px;font-weight:650;letter-spacing:.04em;text-transform:uppercase;color:#64739a;margin-bottom:7px}
.edme-login .inp{position:relative}
.edme-login .inp>svg{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#8795b8}
.edme-login .inp input{width:100%;height:50px;border-radius:14px;border:1px solid rgba(16,30,64,.14);background:rgba(255,255,255,.7);padding:0 44px 0 42px;font-size:14.5px;color:var(--ink);outline:none;transition:.18s}
.edme-login .inp input::placeholder{color:#9aa6c4}
.edme-login .inp input:focus{border-color:var(--blue);background:#fff;box-shadow:0 0 0 4px rgba(28,54,135,.12)}
.edme-login .eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:0;cursor:pointer;color:#8795b8;padding:4px}
.edme-login .row{display:flex;align-items:center;justify-content:space-between;margin:4px 0 20px}
.edme-login .remember{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted)}
.edme-login .remember input{accent-color:var(--blue);width:15px;height:15px}
.edme-login .lk{font-size:13px;font-weight:600;color:var(--blue);text-decoration:none;background:none;border:0;cursor:pointer}
.edme-login .lk:hover{text-decoration:underline}
.edme-login .btn{position:relative;width:100%;height:52px;border:0;border-radius:14px;cursor:pointer;overflow:hidden;font-size:14.5px;font-weight:700;letter-spacing:.01em;color:#fff;background:linear-gradient(180deg,var(--red),var(--red2));box-shadow:0 1px 0 rgba(255,255,255,.3) inset,0 14px 26px -12px rgba(237,27,47,.6);transition:.18s;display:flex;align-items:center;justify-content:center;gap:9px}
.edme-login .btn:hover{filter:brightness(1.05);transform:translateY(-1px)}
.edme-login .btn:disabled{opacity:.7;cursor:default;transform:none}
.edme-login .btn::after{content:"";position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent);transform:skewX(-20deg);animation:el-shine 3.4s ease-in-out infinite}
@keyframes el-shine{0%,60%{left:-60%}100%{left:130%}}
.edme-login .err{margin:0 0 14px;display:flex;gap:8px;align-items:flex-start;background:rgba(237,27,47,.08);color:#b3122a;border-radius:12px;padding:10px 12px;font-size:13px}
.edme-login .foot{margin-top:18px;text-align:center;font-size:12.5px;color:#8795b8}
.edme-login .trust{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:16px;color:#9aa6c4;font-size:11px;flex-wrap:wrap}
.edme-login .trust span{display:inline-flex;align-items:center;gap:6px}
.edme-login .trust .d{width:5px;height:5px;border-radius:50%;background:var(--blue);opacity:.6}
.edme-login .spin{animation:el-spin .7s linear infinite}
@media (max-width:980px){.edme-login{position:absolute}.edme-login .wrap{grid-template-columns:1fr}.edme-login .pitch{display:none}.edme-login .auth{padding:28px 18px}}
`;

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
    <div className="edme-login">
      <style>{CSS}</style>

      <div className="stage">
        <div className="orb b1" /><div className="orb b2" /><div className="orb b3" />
        <div className="gridbg" />
        <svg className="ribbons" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden>
          <path d="M-50,620 C300,560 520,700 760,650 C1020,596 1240,720 1500,660" stroke="#1c3687" />
          <path d="M-50,680 C320,620 540,760 780,700 C1040,642 1260,770 1500,700" stroke="#ed1b2f" />
          <path d="M-50,560 C280,520 500,640 740,590 C1000,540 1220,650 1500,600" stroke="#6b7fc7" />
          <path d="M-50,740 C340,690 560,810 800,760 C1060,706 1280,820 1500,760" stroke="#f0889a" />
        </svg>
      </div>

      <div className="wrap">
        <section className="pitch">
          <div className="brandline"><span className="dash" /> LeasePro AI <span className="byco">· by Edme Insurance Brokers</span></div>
          <h1 className="serif">The intelligence<br />behind every <em>lease.</em></h1>
          <p>Compliant lease accounting under Ind AS 116 &amp; IFRS 16 — contracts, schedules, journals and disclosures, all in one place.</p>
          <div className="feats">
            <div className="feat"><span className="ic">✶</span><div><strong>Standard-perfect by design</strong><span>Ind AS 116 &amp; IFRS 16 built into every schedule.</span></div></div>
            <div className="feat"><span className="ic">◈</span><div><strong>One source of truth</strong><span>Contracts, journals and disclosures in one system.</span></div></div>
            <div className="feat"><span className="ic">⤢</span><div><strong>Audit-ready, always</strong><span>Every figure traceable, every action logged.</span></div></div>
          </div>
        </section>

        <section className="auth">
          <form className="card" onSubmit={handleSubmit}>
            <div className="seal"><i>EST<br />2008</i></div>
            <img className="logo" src="/edme-logo.svg" alt="edme" />
            <div className="kicker">Secure sign-in</div>
            <h2 className="serif">Welcome back</h2>
            <p className="subt">Sign in to continue to your lease accounting workspace.</p>

            <div className="field">
              <label htmlFor="email">Work email</label>
              <div className="inp">
                <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h11A1.5 1.5 0 0 1 17 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5v-9Z" stroke="currentColor" strokeWidth="1.4" /><path d="m4 5.5 6 5 6-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <input id="email" type="email" required autoComplete="email" placeholder="you@edmeinsurance.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>

            <div className="field">
              <label htmlFor="pw">Password</label>
              <div className="inp">
                <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><rect x="4" y="8.5" width="12" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.4" /><path d="M6.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                <input id="pw" type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button className="eye" type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M3 3l14 14M9.9 5.1a5 5 0 0 1 5.6 3M4.5 8.2A5 5 0 0 0 4 10s2.5 4.5 6 4.5c.8 0 1.5-.15 2.2-.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M4 10s2.5-4.5 6-4.5S16 10 16 10s-2.5 4.5-6 4.5S4 10 4 10Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /><circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.4" /></svg>
                  )}
                </button>
              </div>
            </div>

            <div className="row">
              <label className="remember"><input type="checkbox" /> Keep me signed in</label>
              <span className="lk">Accounts are admin-created</span>
            </div>

            {error && (
              <div className="err">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.3" /><path d="M10 6.5v4M10 13.2h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                <span>{error}</span>
              </div>
            )}

            <button className="btn" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <svg className="spin" width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="#fff" strokeWidth="2.5" opacity="0.25" /><path d="M18 10a8 8 0 0 0-8-8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" /></svg>
                  Signing in…
                </>
              ) : (
                <>Enter workspace
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M4 10h11M11 5l5 5-5 5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </>
              )}
            </button>

            <div className="trust">
              <span><i className="d" />256-bit TLS</span><span><i className="d" />Every action audited</span><span><i className="d" />Ind AS 116 / IFRS 16</span>
            </div>
            <p className="foot">Access is provisioned by your organization admin.</p>
          </form>
        </section>
      </div>
    </div>
  );
}
