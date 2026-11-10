"use client";

import { useMemo, useState } from "react";
import type { JournalEntry, Lease, LiabilityScheduleRow, Organization, Profile, RouScheduleRow } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 *  Ind AS 116 / IFRS 16 — Lease Accounting Memorandum
 *  A board / auditor-ready position paper, auto-generated per lease
 *  from the lease's own data and grounded in the standard.
 * ------------------------------------------------------------------ */

type Props = {
  lease: Lease;
  org: Organization | null;
  profile: Profile | null;
  liability: LiabilityScheduleRow[];
  rou: RouScheduleRow[];
  journals: JournalEntry[];
  lessorName?: string | null;
};

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const monthsBetween = (fromISO: string, toISO: string) => {
  const a = new Date(fromISO), b = new Date(toISO);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
};

export function LeaseMemo({ lease, org, profile, liability, rou, journals, lessorName }: Props) {
  const ready = liability.length > 0 && rou.length > 0;

  const html = useMemo(() => (ready ? buildMemo({ lease, org, profile, liability, rou, journals, lessorName }) : null),
    [lease, org, profile, liability, rou, journals, lessorName, ready]);

  const [busy, setBusy] = useState(false);

  async function openStandalone(forPrint: boolean) {
    if (!html) return;
    setBusy(true);
    let logo = "";
    try { logo = await fetch("/edme-logo.svg").then((r) => (r.ok ? r.text() : "")); } catch { /* offline logo ok */ }
    const body = html.body.replace("{{LOGO}}", logo || `<span class="lp-wordmark">${esc(org?.name ?? "Edme")}</span>`);
    const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(lease.lease_code)} — Lease Accounting Memorandum</title><style>${html.css}</style></head><body><div class="lp-memo">${body}</div>${forPrint ? "<script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script>" : ""}</body></html>`;

    if (forPrint) {
      const w = window.open("", "_blank", "noopener,width=900,height=1100");
      if (w) { w.document.write(doc); w.document.close(); }
    } else {
      const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${lease.lease_code}_Lease_Accounting_Memorandum.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    setBusy(false);
  }

  if (!ready) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-600">The accounting memorandum is generated from the computed schedules.</p>
        <p className="mt-1 text-sm text-slate-400">Click &quot;Calculate schedules&quot; above, then return to this tab.</p>
      </div>
    );
  }

  const onPage = html!.body.replace("{{LOGO}}", `<img class="lp-logo-img" src="/edme-logo.svg" alt="${esc(org?.name ?? "Edme")}" />`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-edme-blue/20 bg-gradient-to-br from-edme-blue/5 to-transparent px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">{org?.reporting_standard === "IFRS_16" ? "IFRS 16" : "Ind AS 116"} Lease Accounting Memorandum</p>
          <p className="text-xs text-slate-500">Auditor-ready position paper — auto-generated from this lease&apos;s data, with standard references.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openStandalone(false)}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-edme-blue/40 bg-white px-4 py-2 text-sm font-medium text-edme-blue shadow-sm hover:bg-edme-blue/10 disabled:opacity-60"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 15h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Download HTML
          </button>
          <button
            onClick={() => openStandalone(true)}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-edme-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-edme-blue-2 disabled:opacity-60"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M6 7V3h8v4M6 14H4v-5h12v5h-2M6 12h8v5H6v-5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {busy ? "Preparing…" : "Print / Save as PDF"}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-4 sm:p-8">
        <div className="lp-memo mx-auto">
          <style dangerouslySetInnerHTML={{ __html: html!.css }} />
          <div dangerouslySetInnerHTML={{ __html: onPage }} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ builder ------------------------------ */

function buildMemo(p: Props): { body: string; css: string } {
  const { lease, org, profile, liability, rou, journals } = p;
  const n = (v: string | number | null | undefined) => (typeof v === "number" ? v : parseFloat(v ?? "0") || 0);
  const ccy = lease.currency || org?.functional_currency || "INR";
  const fc = (v: string | number) => formatCurrency(v, ccy);
  const std = org?.reporting_standard === "IFRS_16" ? "IFRS 16" : "Ind AS 116";
  const framework = org?.reporting_standard === "IFRS_16" ? "IFRS 16, Leases" : "Ind AS 116, Leases";

  // ---- core figures ----
  const initLiab = n(liability[0]?.opening_liability);
  const initRou = n(rou[0]?.opening_nbv);
  const idc = n(lease.initial_direct_costs);
  const prepaid = n(lease.prepaid_rent);
  const restoration = n(lease.restoration_cost_estimate);
  const incentives = n(lease.lease_incentives);
  const totalInterest = liability.reduce((s, r) => s + n(r.interest_expense), 0);
  const totalDepr = rou.reduce((s, r) => s + n(r.depreciation), 0);
  const totalPayments = liability.reduce((s, r) => s + n(r.payment), 0);
  const rate = (n(lease.discount_rate_annual) * 100).toFixed(2);

  // ---- current / non-current split (liability due within 12m vs after) ----
  let nonCurrent = 0;
  for (const r of liability) {
    if (monthsBetween(lease.commencement_date, r.period_end) <= 12) nonCurrent = n(r.closing_liability);
  }
  if (lease.lease_term_months <= 12) nonCurrent = 0;
  const current = Math.max(initLiab - nonCurrent, 0);

  // ---- maturity analysis (undiscounted contractual payments) ----
  const mat = { y1: 0, y2_5: 0, gt5: 0 };
  for (const r of liability) {
    const m = monthsBetween(lease.commencement_date, r.period_end);
    const amt = n(r.payment);
    if (m <= 12) mat.y1 += amt;
    else if (m <= 60) mat.y2_5 += amt;
    else mat.gt5 += amt;
  }
  const matTotal = mat.y1 + mat.y2_5 + mat.gt5;
  const financeCharge = matTotal - initLiab;

  // ---- depreciation basis ----
  const deprMonths = lease.useful_life_months && lease.useful_life_months < lease.lease_term_months
    ? lease.useful_life_months : lease.lease_term_months;
  const deprBasis = lease.useful_life_months && lease.useful_life_months < lease.lease_term_months
    ? `the shorter of the lease term and the useful life of the right-of-use asset — here the useful life of ${lease.useful_life_months} months`
    : `the shorter of the lease term and the useful life of the asset — here the lease term of ${lease.lease_term_months} months`;

  // ---- exemption assessment ----
  const stThreshold = org?.short_term_threshold_months ?? 12;
  const exempt = lease.is_short_term || lease.is_low_value;

  // ---- initial journal entry (from generated journals, else synthesised) ----
  const initJ = journals.find((j) => /INITIAL|RECOGNITION/i.test(j.entry_type));

  const preparer = profile?.full_name ?? "Finance Team";
  const today = formatDate(new Date().toISOString());
  const leaseTermYears = (lease.lease_term_months / 12).toFixed(1);

  const cite = (ref: string) => `<span class="lp-cite">${esc(std)} ${esc(ref)}</span>`;
  const row = (c: string[]) => `<tr>${c.map((x, i) => `<td${i ? ' class="num"' : ""}>${x}</td>`).join("")}</tr>`;

  // ======================= BODY =======================
  const body = `
  <article class="lp-page">
    <header class="lp-head">
      <div class="lp-brand">{{LOGO}}</div>
      <div class="lp-org">
        <div class="lp-org-name">${esc(org?.name ?? "Edme Insurance Brokers Limited")}</div>
        <div class="lp-org-meta">${[org?.cin && `CIN ${esc(org.cin)}`, org?.gstin && `GSTIN ${esc(org.gstin)}`].filter(Boolean).join(" &nbsp;·&nbsp; ") || "&nbsp;"}</div>
      </div>
    </header>

    <div class="lp-title-block">
      <div class="lp-kicker">Accounting Position Paper · ${esc(framework)}</div>
      <h1>Lease Accounting Memorandum</h1>
      <div class="lp-subject">${esc(lease.lease_code)} — ${esc(lease.asset_name)}</div>
    </div>

    <table class="lp-facts">
      <tbody>
        ${row([`<b>Lease reference</b>`, esc(lease.lease_code)])}
        ${row([`<b>Underlying asset</b>`, `${esc(lease.asset_name)} <span class="muted">(${esc(lease.asset_category)})</span>`])}
        ${p.lessorName ? row([`<b>Lessor / counterparty</b>`, esc(p.lessorName)]) : ""}
        ${row([`<b>Commencement date</b>`, formatDate(lease.commencement_date)])}
        ${row([`<b>Lease term</b>`, `${lease.lease_term_months} months (${leaseTermYears} years)`])}
        ${row([`<b>Reporting standard</b>`, esc(framework)])}
        ${row([`<b>Prepared by</b>`, `${esc(preparer)} · ${esc(today)}`])}
      </tbody>
    </table>

    <div class="lp-verdict ${exempt ? "amber" : "blue"}">
      <div class="lp-verdict-dot"></div>
      <div>
        <div class="lp-verdict-lead">Accounting conclusion</div>
        <div class="lp-verdict-text">${exempt
          ? `This lease qualifies for the recognition exemption (${lease.is_short_term ? "short-term" : ""}${lease.is_short_term && lease.is_low_value ? " / " : ""}${lease.is_low_value ? "low-value asset" : ""}). Lease payments are recognised as an expense on a straight-line basis; no right-of-use asset or lease liability is recognised.`
          : `This contract is, or contains, a lease within the scope of ${esc(framework)}. A right-of-use asset of <b>${fc(initRou)}</b> and a lease liability of <b>${fc(initLiab)}</b> are recognised at the commencement date.`}</div>
      </div>
    </div>

    <!-- 1. Purpose & scope -->
    <section class="lp-sec">
      <h2><span>1</span> Purpose &amp; scope ${cite("paras 3–4")}</h2>
      <p>This memorandum documents the accounting treatment of the above lease under ${esc(framework)} and supports the amounts recognised in the financial statements of ${esc(org?.name ?? "the Company")}. ${esc(std)} establishes the principles for the recognition, measurement, presentation and disclosure of leases, with the objective that lessees and lessors provide relevant information that faithfully represents those transactions.</p>
    </section>

    <!-- 2. Identification -->
    <section class="lp-sec">
      <h2><span>2</span> Does the contract contain a lease? ${cite("paras 9, B9–B31")}</h2>
      <p>A contract is, or contains, a lease if it conveys the right to control the use of an identified asset for a period of time in exchange for consideration. Management has assessed the arrangement against the control criteria:</p>
      <table class="lp-assess">
        <tbody>
          ${row([`Identified asset — a specified asset (${esc(lease.asset_name)})${lease.location ? ` at ${esc(lease.location)}` : ""}, with no substantive supplier substitution rights`, `<span class="yes">Met</span>`])}
          ${row([`Right to obtain substantially all of the economic benefits from use of the asset throughout the period of use`, `<span class="yes">Met</span>`])}
          ${row([`Right to direct how and for what purpose the asset is used throughout the period of use`, `<span class="yes">Met</span>`])}
        </tbody>
      </table>
      <p class="lp-note">Conclusion: the control criteria are met and the arrangement is accounted for as a lease.</p>
    </section>

    <!-- 3. Recognition exemptions -->
    <section class="lp-sec">
      <h2><span>3</span> Recognition exemptions ${cite("paras 5–8")}</h2>
      <p>A lessee may elect not to apply the recognition requirements to (a) short-term leases (term of ${stThreshold} months or less with no purchase option) and (b) leases for which the underlying asset is of low value.</p>
      <table class="lp-assess">
        <tbody>
          ${row([`Short-term lease (≤ ${stThreshold} months, no purchase option)`, lease.is_short_term ? `<span class="yes">Applied</span>` : `<span class="no">Not applied — term is ${lease.lease_term_months} months</span>`])}
          ${row([`Low-value underlying asset`, lease.is_low_value ? `<span class="yes">Applied</span>` : `<span class="no">Not applied</span>`])}
        </tbody>
      </table>
      <p class="lp-note">${exempt
        ? `The exemption is applied; the lease is accounted for off-balance-sheet with a straight-line lease expense.`
        : `No exemption is available or elected; the lease is recognised on the balance sheet as set out below.`}</p>
    </section>

    ${exempt ? "" : `
    <!-- 4. Key judgements -->
    <section class="lp-sec">
      <h2><span>4</span> Key judgements &amp; estimates</h2>
      <table class="lp-kv">
        <tbody>
          ${row([`<b>Lease term ${cite("paras 18–19")}</b><br><span class="muted">Non-cancellable period plus periods covered by options reasonably certain to be exercised.</span>`,
            `${lease.lease_term_months} months<br><span class="muted">${lease.non_cancellable_period_months || lease.lease_term_months} mo non-cancellable${lease.renewal_option_months ? `, ${lease.renewal_option_months} mo renewal ${lease.reasonably_certain_to_renew ? "included (reasonably certain)" : "excluded"}` : ""}</span>`])}
          ${row([`<b>Discount rate ${cite("para 26")}</b><br><span class="muted">Rate implicit in the lease, or the lessee's incremental borrowing rate where that rate is not readily determinable.</span>`,
            `${rate}% p.a.<br><span class="muted">${org?.discount_rate_mode === "UNIFORM" ? "Group incremental borrowing rate" : "Lease-specific incremental borrowing rate"}</span>`])}
          ${row([`<b>Lease payments ${cite("para 27")}</b><br><span class="muted">Fixed payments less incentives, plus in-substance fixed and index/rate-based amounts.</span>`,
            `${fc(lease.base_payment_amount)} / ${esc(lease.payment_frequency.toLowerCase())}<br><span class="muted">${lease.payment_timing === "ADVANCE" ? "Payable in advance" : "Payable in arrears"}${lease.escalation_type !== "NONE" ? ` · ${esc(lease.escalation_percent)}% escalation every ${lease.escalation_frequency_months} mo` : ""}</span>`])}
        </tbody>
      </table>
    </section>

    <!-- 5. Initial recognition -->
    <section class="lp-sec">
      <h2><span>5</span> Initial recognition &amp; measurement ${cite("paras 22–26")}</h2>
      <p>At the commencement date the lease liability is measured at the present value of the lease payments not yet paid, discounted at ${rate}% p.a. The right-of-use asset is measured at cost, comprising the initial liability, lease payments made at or before commencement, initial direct costs and estimated restoration costs, less incentives received.</p>
      <table class="lp-money">
        <thead><tr><th>Right-of-use asset — cost build-up</th><th class="num">${esc(ccy)}</th></tr></thead>
        <tbody>
          ${row([`Present value of lease liability`, fc(initLiab)])}
          ${row([`Add: initial direct costs`, fc(idc)])}
          ${row([`Add: prepaid lease payments`, fc(prepaid)])}
          ${row([`Add: estimated restoration / dismantling cost (Ind AS 37)`, fc(restoration)])}
          ${row([`Less: lease incentives received`, `(${fc(incentives)})`])}
          <tr class="total">${[`Right-of-use asset at commencement`, `<b>${fc(initRou)}</b>`].map((x, i) => `<td${i ? ' class="num"' : ""}>${x}</td>`).join("")}</tr>
        </tbody>
      </table>

      <h3>Initial journal entry</h3>
      <table class="lp-je">
        <thead><tr><th>Account</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead>
        <tbody>
          ${initJ
            ? initJ.lines.map((l) => row([esc(l.account_name), n(l.debit) ? fc(l.debit) : "", n(l.credit) ? fc(l.credit) : ""])).join("")
            : [
                row([`Right-of-use asset`, fc(initRou), ``]),
                row([`Lease liability`, ``, fc(initLiab)]),
                idc ? row([`Bank / creditor (initial direct costs)`, ``, fc(idc)]) : "",
                restoration ? row([`Provision for restoration (Ind AS 37)`, ``, fc(restoration)]) : "",
                incentives ? row([`Right-of-use asset (incentive)`, ``, fc(incentives)]) : "",
              ].join("")}
        </tbody>
      </table>
    </section>

    <!-- 6. Subsequent measurement -->
    <section class="lp-sec">
      <h2><span>6</span> Subsequent measurement ${cite("paras 29–38")}</h2>
      <p><b>Right-of-use asset (cost model).</b> The asset is carried at cost less accumulated depreciation and impairment, depreciated on a straight-line basis over ${esc(deprBasis)} (${deprMonths} months). Total depreciation over the lease is <b>${fc(totalDepr)}</b>.</p>
      <p><b>Lease liability (amortised cost).</b> The liability is subsequently increased by interest at the discount rate and reduced by lease payments. Total interest (finance cost) over the lease is <b>${fc(totalInterest)}</b> on total payments of <b>${fc(totalPayments)}</b>.</p>
      <table class="lp-money">
        <thead><tr><th>Lease liability — balance-sheet classification at commencement ${cite("Sch III / Ind AS 1")}</th><th class="num">${esc(ccy)}</th></tr></thead>
        <tbody>
          ${row([`Current (due within 12 months)`, fc(current)])}
          ${row([`Non-current (due after 12 months)`, fc(nonCurrent)])}
          <tr class="total">${[`Total lease liability`, `<b>${fc(initLiab)}</b>`].map((x, i) => `<td${i ? ' class="num"' : ""}>${x}</td>`).join("")}</tr>
        </tbody>
      </table>
    </section>

    <!-- 7. Presentation -->
    <section class="lp-sec">
      <h2><span>7</span> Presentation ${cite("paras 47–50")}</h2>
      <ul class="lp-list">
        <li>Right-of-use assets are presented separately from other assets (or within the line item in which the equivalent owned assets would be presented, with disclosure).</li>
        <li>Lease liabilities are presented separately from other liabilities, split between current and non-current.</li>
        <li>In the statement of profit and loss, depreciation of the right-of-use asset and interest on the lease liability are presented separately; interest forms part of finance costs.</li>
        <li>In the cash flow statement, the principal portion of lease payments is a financing activity and the interest portion is presented consistently with other interest paid.</li>
      </ul>
    </section>

    <!-- 8. Disclosures -->
    <section class="lp-sec">
      <h2><span>8</span> Disclosures ${cite("paras 51–60")}</h2>
      <p>The following amounts relating to this lease feed the lessee disclosure note:</p>
      <table class="lp-money">
        <tbody>
          ${row([`Additions to right-of-use assets`, fc(initRou)])}
          ${row([`Depreciation charge — right-of-use asset (over lease)`, fc(totalDepr)])}
          ${row([`Interest expense on lease liability (over lease)`, fc(totalInterest)])}
          ${row([`Total cash outflow for the lease`, fc(totalPayments)])}
        </tbody>
      </table>
      <h3>Maturity analysis of lease liabilities — undiscounted ${cite("para 58 · Ind AS 107")}</h3>
      <table class="lp-money">
        <thead><tr><th>Contractual maturity</th><th class="num">${esc(ccy)}</th></tr></thead>
        <tbody>
          ${row([`Not later than one year`, fc(mat.y1)])}
          ${row([`Later than one year and not later than five years`, fc(mat.y2_5)])}
          ${row([`Later than five years`, fc(mat.gt5)])}
          ${row([`Total undiscounted lease payments`, fc(matTotal)])}
          ${row([`Less: future finance charges`, `(${fc(financeCharge)})`])}
          <tr class="total">${[`Present value of lease liabilities`, `<b>${fc(initLiab)}</b>`].map((x, i) => `<td${i ? ' class="num"' : ""}>${x}</td>`).join("")}</tr>
        </tbody>
      </table>
    </section>
    `}

    <!-- Sign-off -->
    <section class="lp-sign">
      <div class="lp-sign-col"><div class="lp-sign-line"></div><div class="lp-sign-role">Prepared by</div><div class="lp-sign-name">${esc(preparer)}</div><div class="lp-sign-sub">${esc(today)}</div></div>
      <div class="lp-sign-col"><div class="lp-sign-line"></div><div class="lp-sign-role">Reviewed by</div><div class="lp-sign-name">&nbsp;</div><div class="lp-sign-sub">Finance Controller</div></div>
      <div class="lp-sign-col"><div class="lp-sign-line"></div><div class="lp-sign-role">Approved by</div><div class="lp-sign-name">&nbsp;</div><div class="lp-sign-sub">CFO</div></div>
    </section>

    <footer class="lp-foot">
      <span>${esc(org?.name ?? "Edme Insurance Brokers Limited")} · ${esc(framework)} Accounting Memorandum</span>
      <span>Generated by LeasePro AI · ${esc(today)}</span>
    </footer>
  </article>`;

  return { body, css: MEMO_CSS };
}

/* ------------------------------- CSS -------------------------------- */

const MEMO_CSS = `
.lp-memo{--navy:#0b1b5e;--blue:#1c3687;--red:#ed1b2f;--ink:#111a30;--muted:#64739a;--line:#e3e8f3;--soft:#f6f8fd;
  max-width:820px;color:var(--ink);font-family:"Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;font-size:13.5px;line-height:1.6;}
.lp-memo *{box-sizing:border-box;}
.lp-page{background:#fff;border-radius:14px;box-shadow:0 20px 60px -30px rgba(11,27,94,.35),0 2px 8px -4px rgba(11,27,94,.12);padding:46px 52px 30px;}
.lp-head{display:flex;align-items:center;justify-content:space-between;gap:20px;padding-bottom:18px;border-bottom:2px solid var(--navy);}
.lp-brand{display:flex;align-items:center;}
.lp-brand .lp-logo-img{height:30px;display:block;}
.lp-brand svg{height:30px;width:auto;}
.lp-wordmark{font-weight:800;font-size:20px;color:var(--navy);letter-spacing:-.01em;}
.lp-org{text-align:right;}
.lp-org-name{font-weight:700;font-size:14px;color:var(--navy);}
.lp-org-meta{font-size:11px;color:var(--muted);margin-top:2px;letter-spacing:.02em;}
.lp-title-block{text-align:center;padding:30px 0 22px;}
.lp-kicker{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--red);}
.lp-title-block h1{margin:8px 0 4px;font-family:Georgia,"Times New Roman",serif;font-weight:600;font-size:30px;color:var(--navy);letter-spacing:-.01em;}
.lp-subject{font-size:14px;color:var(--muted);}
.lp-facts{width:100%;border-collapse:collapse;margin:6px 0 22px;font-size:12.5px;}
.lp-facts td{padding:7px 10px;border-bottom:1px solid var(--line);vertical-align:top;}
.lp-facts td:first-child{width:38%;color:var(--muted);}
.lp-facts b{color:var(--ink);font-weight:600;}
.muted{color:var(--muted);}
.lp-verdict{display:flex;gap:14px;align-items:flex-start;border-radius:12px;padding:16px 18px;margin:0 0 26px;border:1px solid var(--line);}
.lp-verdict.blue{background:linear-gradient(135deg,rgba(28,54,135,.07),rgba(28,54,135,.02));border-color:rgba(28,54,135,.25);}
.lp-verdict.amber{background:linear-gradient(135deg,rgba(234,165,30,.1),rgba(234,165,30,.03));border-color:rgba(234,165,30,.35);}
.lp-verdict-dot{flex:0 0 10px;height:10px;border-radius:50%;margin-top:6px;background:var(--blue);}
.lp-verdict.amber .lp-verdict-dot{background:#e0981a;}
.lp-verdict-lead{font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:3px;}
.lp-verdict-text{font-size:13px;}
.lp-sec{margin:0 0 22px;}
.lp-sec h2{display:flex;align-items:center;gap:11px;font-size:15.5px;font-weight:700;color:var(--navy);margin:0 0 9px;padding-bottom:7px;border-bottom:1px solid var(--line);}
.lp-sec h2 span{flex:0 0 24px;height:24px;border-radius:7px;display:inline-grid;place-items:center;background:var(--navy);color:#fff;font-size:12px;font-weight:700;}
.lp-sec h3{font-size:12.5px;font-weight:700;color:var(--ink);margin:16px 0 7px;text-transform:uppercase;letter-spacing:.04em;}
.lp-sec p{margin:0 0 9px;}
.lp-cite{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:20px;background:var(--soft);border:1px solid var(--line);font-size:10px;font-weight:600;color:var(--blue);letter-spacing:.02em;vertical-align:middle;}
.lp-note{font-size:12.5px;color:var(--ink);background:var(--soft);border-left:3px solid var(--blue);padding:8px 12px;border-radius:0 8px 8px 0;}
.lp-list{margin:0;padding-left:18px;}
.lp-list li{margin:0 0 6px;}
table.lp-assess,table.lp-kv,table.lp-money,table.lp-je{width:100%;border-collapse:collapse;margin:4px 0 6px;font-size:12.5px;}
.lp-assess td,.lp-kv td{padding:9px 12px;border:1px solid var(--line);vertical-align:top;}
.lp-assess td:first-child,.lp-kv td:first-child{width:72%;}
.lp-kv td:first-child{width:58%;}
.yes{display:inline-block;padding:2px 10px;border-radius:20px;background:rgba(16,153,96,.12);color:#0b7a4a;font-weight:700;font-size:11px;}
.no{display:inline-block;padding:2px 10px;border-radius:20px;background:rgba(100,115,154,.12);color:var(--muted);font-weight:600;font-size:11px;}
.lp-money th,.lp-je th{text-align:left;background:var(--navy);color:#fff;padding:9px 12px;font-size:11.5px;font-weight:600;}
.lp-money th.num,.lp-je th.num{text-align:right;}
.lp-money td,.lp-je td{padding:8px 12px;border-bottom:1px solid var(--line);}
.lp-money td.num,.lp-je td.num,.lp-facts td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}
.lp-money tr.total td{border-top:2px solid var(--navy);border-bottom:none;background:var(--soft);font-weight:700;}
.lp-je tbody tr:last-child td{border-bottom:2px solid var(--navy);}
.lp-sign{display:flex;gap:28px;margin:34px 0 18px;}
.lp-sign-col{flex:1;text-align:center;}
.lp-sign-line{height:1px;background:#9aa6c4;margin:28px 0 8px;}
.lp-sign-role{font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);}
.lp-sign-name{font-size:13px;font-weight:600;color:var(--ink);margin-top:2px;}
.lp-sign-sub{font-size:11px;color:var(--muted);}
.lp-foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-top:14px;margin-top:10px;border-top:1px solid var(--line);font-size:10.5px;color:var(--muted);}
@media print{
  @page{size:A4;margin:16mm 14mm;}
  body{background:#fff;}
  .lp-page{box-shadow:none;border-radius:0;padding:0;}
  .lp-sec,.lp-verdict,.lp-sign{break-inside:avoid;}
  .lp-sec h2{break-after:avoid;}
}
@media (max-width:640px){
  .lp-page{padding:26px 20px;}
  .lp-head{flex-direction:column;align-items:flex-start;gap:10px;}
  .lp-org{text-align:left;}
  .lp-sign{flex-direction:column;gap:10px;}
}
`;
