# LeasePro AI

**Smart Lease Accounting. Powered by AI. Compliant with Ind AS 116 & IFRS 16.**

Enterprise-grade lease accounting & lease management platform. This repo is the
**Phase 1 MVP**: auth, organization/lease/lessor masters, the real Ind AS 116 /
IFRS 16 calculation engine (initial recognition, liability amortization, ROU
depreciation, remeasurement/modification, disclosures, short-term & low-value
exemptions), core reports, and audit trail.

Later phases (deferred, not in this build): the "LISA" AI assistant, ERP
integrations (SAP/Oracle/Dynamics/SunSystems), OCR, mobile app, multi-GAAP /
multi-currency.

## Architecture

```
LeasePro-AI/
├─ apps/
│  ├─ web/     ← Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
│  └─ api/     ← FastAPI (Python) — Ind AS 116/IFRS 16 engine + REST API
├─ supabase/
│  └─ migrations/  ← Postgres schema, RLS policies
```

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, deployed on Vercel |
| Backend | FastAPI (Python 3.11+), Pydantic v2 |
| Database / Auth | Supabase (Postgres + Row Level Security + Auth) |
| Accounting engine | Pure Python, `decimal`-based, unit-tested against worked IFRS 16 examples |

## Local development

### Backend
```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env          # fill in SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_JWT_SECRET
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd apps/web
npm install
cp .env.local.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / NEXT_PUBLIC_API_URL
npm run dev
```

### Database
Migrations live in `supabase/migrations/`. Apply with the Supabase CLI
(`supabase db push`) or via the Supabase MCP/dashboard.

## Compliance scope (Phase 1)

- Initial recognition: lease liability at PV of unpaid payments, ROU asset
  (liability + initial direct costs + prepayments − incentives + restoration
  cost estimate)
- Subsequent measurement: effective-interest amortization of the liability,
  straight-line (or usage-based) depreciation of the ROU asset
- Modifications & remeasurement: term/payment/discount-rate changes,
  partial/full termination
- Short-term (≤12 months) and low-value asset exemptions (straight-line
  expense, no balance sheet recognition)
- Security deposit present value (day-1 discount treated as prepaid rent)
- Disclosures: maturity analysis, weighted-average discount rate, ROU/liability
  rollforward, total cash outflow for leases
