import calendar
from datetime import date


def add_months(start: date, months: int) -> date:
    """Add calendar months to a date, clamping the day to the target month's length
    (e.g. Jan 31 + 1 month = Feb 28/29, not Mar 3)."""
    month_index = start.month - 1 + months
    year = start.year + month_index // 12
    month = month_index % 12 + 1
    day = min(start.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)
