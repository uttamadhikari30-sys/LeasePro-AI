from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from supabase import Client

from ..deps import get_user_scoped_db
from ..engine.disclosures import (
    build_disclosure_note,
    maturity_analysis,
    total_cash_outflow,
    weighted_average_discount_rate,
)
from ..engine.models import PaymentLine
from ..schemas import DisclosureSummary, MaturityBucketOut

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/lease-register")
def lease_register(db: Client = Depends(get_user_scoped_db)):
    """One row per lease with its lessor and current ROU/liability balances."""
    leases = db.table("leases").select("*, lessors(name)").order("lease_code").execute().data
    register = []
    for lease in leases:
        latest_liability = (
            db.table("lease_liability_schedule")
            .select("closing_liability")
            .eq("lease_id", lease["id"])
            .order("period_number", desc=True)
            .limit(1)
            .execute()
            .data
        )
        latest_rou = (
            db.table("rou_asset_schedule")
            .select("closing_nbv")
            .eq("lease_id", lease["id"])
            .order("period_number", desc=True)
            .limit(1)
            .execute()
            .data
        )
        register.append(
            {
                **lease,
                "current_lease_liability": latest_liability[0]["closing_liability"] if latest_liability else None,
                "current_rou_nbv": latest_rou[0]["closing_nbv"] if latest_rou else None,
            }
        )
    return register


@router.get("/rou-register")
def rou_register(db: Client = Depends(get_user_scoped_db)):
    leases = db.table("leases").select("id, lease_code, asset_name, asset_category").execute().data
    result = []
    for lease in leases:
        schedule = (
            db.table("rou_asset_schedule")
            .select("*")
            .eq("lease_id", lease["id"])
            .order("period_number")
            .execute()
            .data
        )
        result.append({**lease, "schedule": schedule})
    return result


@router.get("/liability-rollforward")
def liability_rollforward(db: Client = Depends(get_user_scoped_db)):
    leases = db.table("leases").select("id, lease_code, asset_name").execute().data
    result = []
    for lease in leases:
        schedule = (
            db.table("lease_liability_schedule")
            .select("*")
            .eq("lease_id", lease["id"])
            .order("period_number")
            .execute()
            .data
        )
        result.append({**lease, "schedule": schedule})
    return result


@router.get("/security-deposit-register")
def security_deposit_register(db: Client = Depends(get_user_scoped_db)):
    leases = db.table("leases").select("id, lease_code, asset_name").execute().data
    result = []
    for lease in leases:
        deposits = db.table("security_deposits").select("*").eq("lease_id", lease["id"]).execute().data
        if deposits:
            result.append({**lease, "deposits": deposits})
    return result


@router.get("/disclosures", response_model=DisclosureSummary)
def disclosures(
    as_of_date: date = Query(default_factory=date.today),
    db: Client = Depends(get_user_scoped_db),
):
    leases = db.table("leases").select("id, discount_rate_annual").eq("status", "ACTIVE").execute().data

    all_payments: list[PaymentLine] = []
    wadr_inputs: list[tuple[Decimal, Decimal]] = []
    total_liability = Decimal("0")
    total_rou = Decimal("0")
    period_cash_outflows: list[Decimal] = []

    for lease in leases:
        payments = db.table("lease_payment_schedule").select("*").eq("lease_id", lease["id"]).execute().data
        for p in payments:
            all_payments.append(
                PaymentLine(
                    period_number=p["period_number"],
                    due_date=date.fromisoformat(p["due_date"]),
                    amount=Decimal(str(p["payment_amount"])),
                )
            )

        latest_liability = (
            db.table("lease_liability_schedule")
            .select("closing_liability, payment, period_end")
            .eq("lease_id", lease["id"])
            .order("period_number", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if latest_liability:
            balance = Decimal(str(latest_liability[0]["closing_liability"]))
            total_liability += balance
            wadr_inputs.append((balance, Decimal(str(lease["discount_rate_annual"]))))

        latest_rou = (
            db.table("rou_asset_schedule")
            .select("closing_nbv")
            .eq("lease_id", lease["id"])
            .order("period_number", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if latest_rou:
            total_rou += Decimal(str(latest_rou[0]["closing_nbv"]))

        ytd_rows = (
            db.table("lease_liability_schedule")
            .select("payment, period_end")
            .eq("lease_id", lease["id"])
            .lte("period_end", as_of_date.isoformat())
            .gte("period_end", date(as_of_date.year, 1, 1).isoformat())
            .execute()
            .data
        )
        period_cash_outflows.extend(Decimal(str(r["payment"])) for r in ytd_rows)

    return DisclosureSummary(
        total_rou_asset_nbv=total_rou,
        total_lease_liability=total_liability,
        weighted_average_discount_rate=weighted_average_discount_rate(wadr_inputs),
        maturity_analysis=[
            MaturityBucketOut(**bucket.__dict__) for bucket in maturity_analysis(all_payments, as_of_date)
        ],
        total_cash_outflow_ytd=total_cash_outflow(period_cash_outflows),
    )


@router.get("/disclosure-note")
def disclosure_note(
    as_of_date: date = Query(default_factory=date.today),
    db: Client = Depends(get_user_scoped_db),
):
    """Ready-to-use Ind AS 116 / IFRS 16 financial-statement disclosure note,
    populated with the organisation's figures."""
    org = (
        db.table("organizations")
        .select("name, reporting_standard, functional_currency, fiscal_year_start_month")
        .single()
        .execute()
        .data
    )
    fy_start_month = org["fiscal_year_start_month"]
    fy_start_year = as_of_date.year if as_of_date.month >= fy_start_month else as_of_date.year - 1
    fy_start = date(fy_start_year, fy_start_month, 1)
    one_year_out = date(as_of_date.year + 1, as_of_date.month, min(as_of_date.day, 28))

    leases = db.table("leases").select("*").execute().data

    all_payments: list[PaymentLine] = []
    wadr_inputs: list[tuple[Decimal, Decimal]] = []
    total_liability = current_liability = total_rou = Decimal("0")
    depreciation_ytd = interest_ytd = cash_ytd = additions_ytd = Decimal("0")
    short_term_ytd = low_value_ytd = Decimal("0")
    rou_by_category: dict[str, Decimal] = {}

    for lease in leases:
        # Exempt leases -> straight-line expense, no ROU/liability.
        if lease["is_short_term"] or lease["is_low_value"]:
            payments = db.table("lease_payment_schedule").select("*").eq("lease_id", lease["id"]).execute().data
            ytd = sum(
                (Decimal(str(p["payment_amount"])) for p in payments if fy_start.isoformat() <= p["due_date"] <= as_of_date.isoformat()),
                Decimal("0"),
            )
            if lease["is_short_term"]:
                short_term_ytd += ytd
            else:
                low_value_ytd += ytd
            continue

        payments = db.table("lease_payment_schedule").select("*").eq("lease_id", lease["id"]).execute().data
        for p in payments:
            all_payments.append(
                PaymentLine(period_number=p["period_number"], due_date=date.fromisoformat(p["due_date"]), amount=Decimal(str(p["payment_amount"])))
            )

        liab_rows = db.table("lease_liability_schedule").select("*").eq("lease_id", lease["id"]).order("period_number").execute().data
        rou_rows = db.table("rou_asset_schedule").select("*").eq("lease_id", lease["id"]).order("period_number").execute().data
        if not liab_rows or not rou_rows:
            continue

        balance = Decimal(str(liab_rows[-1]["closing_liability"]))
        total_liability += balance
        wadr_inputs.append((balance, Decimal(str(lease["discount_rate_annual"]))))
        # Current portion = principal repaid within the next 12 months.
        current_liability += sum(
            (Decimal(str(r["payment"])) - Decimal(str(r["interest_expense"]))
             for r in liab_rows if as_of_date.isoformat() < r["period_end"] <= one_year_out.isoformat()),
            Decimal("0"),
        )

        rou_nbv = Decimal(str(rou_rows[-1]["closing_nbv"]))
        total_rou += rou_nbv
        cat = lease["asset_category"] or "Other"
        rou_by_category[cat] = rou_by_category.get(cat, Decimal("0")) + rou_nbv

        # ROU additions in the current fiscal year.
        if fy_start.isoformat() <= lease["commencement_date"] <= as_of_date.isoformat():
            additions_ytd += Decimal(str(rou_rows[0]["opening_nbv"]))

        for r in liab_rows:
            if fy_start.isoformat() <= r["period_end"] <= as_of_date.isoformat():
                interest_ytd += Decimal(str(r["interest_expense"]))
                cash_ytd += Decimal(str(r["payment"]))
        for r in rou_rows:
            if fy_start.isoformat() <= r["period_end"] <= as_of_date.isoformat():
                depreciation_ytd += Decimal(str(r["depreciation"]))

    maturity = maturity_analysis(all_payments, as_of_date)
    wadr = weighted_average_discount_rate(wadr_inputs)
    non_current = total_liability - current_liability

    note = build_disclosure_note(
        standard=org["reporting_standard"],
        entity_name=org["name"],
        as_of_date=as_of_date,
        currency=org["functional_currency"],
        total_rou_nbv=total_rou,
        rou_by_category=rou_by_category,
        total_liability=total_liability,
        current_liability=current_liability,
        non_current_liability=non_current,
        depreciation_ytd=depreciation_ytd,
        interest_ytd=interest_ytd,
        short_term_expense_ytd=short_term_ytd,
        low_value_expense_ytd=low_value_ytd,
        total_cash_outflow_ytd=cash_ytd,
        additions_ytd=additions_ytd,
        wadr=wadr,
        maturity=maturity,
    )
    return {
        "standard": org["reporting_standard"],
        "entity_name": org["name"],
        "as_of_date": as_of_date.isoformat(),
        "note_markdown": note,
    }


@router.get("/export.xlsx")
def export_excel(db: Client = Depends(get_user_scoped_db)):
    """Edme-branded Excel workbook of all lease registers and disclosures."""
    from ..services.excel_service import build_reports_workbook

    org = db.table("organizations").select("name").single().execute().data
    data = {
        "lease_register": lease_register(db),
        "rou_register": rou_register(db),
        "liability_rollforward": liability_rollforward(db),
        "deposit_register": security_deposit_register(db),
        "disclosures": disclosures(db=db).model_dump(mode="json"),
    }
    content = build_reports_workbook(org["name"], data)
    filename = f"LeasePro_Reports_{date.today().isoformat()}.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/audit-trail")
def audit_trail(
    entity_type: str | None = None,
    limit: int = 100,
    db: Client = Depends(get_user_scoped_db),
):
    query = db.table("audit_log").select("*").order("created_at", desc=True).limit(limit)
    if entity_type:
        query = query.eq("entity_type", entity_type)
    return query.execute().data
