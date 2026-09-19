"""Bulk-import leases (with opening balances and deposits) from a workbook."""
from datetime import date
from decimal import Decimal, InvalidOperation

from supabase import Client

from ..engine.security_deposit import compute_security_deposit
from . import lease_service
from .excel_service import parse_import_workbook

_FREQ = {"MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUALLY"}
_TIMING = {"ARREARS", "ADVANCE"}
_ESC = {"NONE", "FIXED_PERCENT", "CUSTOM"}
_EXAMPLE_CODE = "LSE-2026-001"


def _s(v):
    return str(v).strip() if v is not None else ""


def _dec(v, default="0"):
    if v in (None, ""):
        return Decimal(default)
    return Decimal(str(v))


def _bool(v):
    return _s(v).lower() in ("yes", "true", "1", "y")


def _date(v) -> str:
    if isinstance(v, date):
        return v.isoformat()
    s = _s(v)
    # Validate format; raises if wrong.
    return date.fromisoformat(s).isoformat()


def import_leases(db: Client, org_id: str, user_id: str, file_bytes: bytes) -> dict:
    rows = parse_import_workbook(file_bytes)
    created = 0
    errors: list[dict] = []

    # Cache lessors by lowercased name.
    lessors = db.table("lessors").select("id, name").execute().data
    lessor_by_name = {l["name"].lower().strip(): l["id"] for l in lessors}

    for rec in rows:
        row_no = rec.get("_row")
        code = _s(rec.get("lease_code"))
        # Skip the untouched example row.
        if code == _EXAMPLE_CODE and _s(rec.get("lessor_name")) == "ABC Properties Pvt Ltd":
            continue
        try:
            if not code:
                raise ValueError("lease_code is required")
            lessor_name = _s(rec.get("lessor_name"))
            if not lessor_name:
                raise ValueError("lessor_name is required")
            freq = _s(rec.get("payment_frequency")).upper() or "MONTHLY"
            timing = _s(rec.get("payment_timing")).upper() or "ARREARS"
            esc = _s(rec.get("escalation_type")).upper() or "NONE"
            if freq not in _FREQ:
                raise ValueError(f"payment_frequency '{freq}' invalid")
            if timing not in _TIMING:
                raise ValueError(f"payment_timing '{timing}' invalid")
            if esc not in _ESC:
                raise ValueError(f"escalation_type '{esc}' invalid")

            lessor_id = lessor_by_name.get(lessor_name.lower())
            if not lessor_id:
                new_lessor = db.table("lessors").insert({"org_id": org_id, "name": lessor_name}).execute().data[0]
                lessor_id = new_lessor["id"]
                lessor_by_name[lessor_name.lower()] = lessor_id

            is_transition = _bool(rec.get("is_transition"))
            term = int(_dec(rec.get("lease_term_months")))
            body = {
                "org_id": org_id,
                "lessor_id": lessor_id,
                "lease_code": code,
                "asset_name": _s(rec.get("asset_name")) or code,
                "asset_category": _s(rec.get("asset_category")) or "Other",
                "location": _s(rec.get("location")) or None,
                "commencement_date": _date(rec.get("commencement_date")),
                "lease_term_months": term,
                "non_cancellable_period_months": int(_dec(rec.get("non_cancellable_period_months"), str(term))),
                "payment_frequency": freq,
                "payment_timing": timing,
                "base_payment_amount": str(_dec(rec.get("base_payment_amount"))),
                "escalation_type": esc,
                "escalation_percent": str(_dec(rec.get("escalation_percent"))),
                "escalation_frequency_months": int(_dec(rec.get("escalation_frequency_months"), "12")),
                "discount_rate_annual": str(_dec(rec.get("discount_rate_annual"), "0.10")),
                "currency": _s(rec.get("currency")) or "INR",
                "is_short_term": _bool(rec.get("is_short_term")),
                "is_low_value": _bool(rec.get("is_low_value")),
                "is_transition": is_transition,
                "created_by": user_id,
            }
            if is_transition:
                body["opening_date"] = _date(rec.get("opening_date"))
                body["opening_liability"] = str(_dec(rec.get("opening_liability")))
                if _s(rec.get("opening_rou_nbv")):
                    body["opening_rou_nbv"] = str(_dec(rec.get("opening_rou_nbv")))

            lease = db.table("leases").insert(body).execute().data[0]

            # Optional security deposit.
            dep_amt = rec.get("security_deposit_amount")
            if dep_amt not in (None, "") and _dec(dep_amt) > 0:
                paid = _date(rec.get("deposit_paid_date") or rec.get("commencement_date"))
                refund = _date(rec.get("deposit_refund_date")) if _s(rec.get("deposit_refund_date")) else _date(rec.get("commencement_date"))
                dep_rate = _dec(rec.get("deposit_discount_rate"), str(_dec(rec.get("discount_rate_annual"), "0.10")))
                result = compute_security_deposit(_dec(dep_amt), date.fromisoformat(paid), date.fromisoformat(refund), dep_rate)
                dep = db.table("security_deposits").insert({
                    "lease_id": lease["id"], "deposit_amount": str(_dec(dep_amt)), "paid_date": paid,
                    "refundable": True, "expected_refund_date": refund, "discount_rate_annual": str(dep_rate),
                    "present_value": str(result.present_value), "prepaid_rent_component": str(result.prepaid_rent_component),
                }).execute().data[0]
                db.table("security_deposit_schedule").insert([
                    {"security_deposit_id": dep["id"], "period_number": s.period_number, "period_date": s.period_date.isoformat(),
                     "opening_balance": str(s.opening_balance), "interest_income": str(s.interest_income), "closing_balance": str(s.closing_balance)}
                    for s in result.schedule
                ]).execute()

            # Calculate schedules so the lease is immediately usable.
            calc_lease = dict(lease)
            calc_lease["commencement_date"] = date.fromisoformat(lease["commencement_date"])
            lease_service.calculate_lease(db, calc_lease, {}, user_id)
            created += 1
        except (ValueError, InvalidOperation, KeyError) as exc:
            errors.append({"row": row_no, "lease_code": code, "message": str(exc)})
        except Exception as exc:  # noqa: BLE001 -- surface any per-row failure without aborting the batch
            errors.append({"row": row_no, "lease_code": code, "message": f"{type(exc).__name__}: {exc}"})

    return {"created": created, "errors": errors}
