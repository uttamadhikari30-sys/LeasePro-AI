import base64

import anthropic
from fastapi import HTTPException

from ..config import get_settings

EXTRACTION_TOOL = {
    "name": "record_lease_terms",
    "description": "Record the lease terms extracted from the uploaded lease agreement document.",
    "input_schema": {
        "type": "object",
        "properties": {
            "lessor_name": {"type": "string", "description": "Legal name of the lessor/landlord as stated in the contract"},
            "asset_name": {"type": "string", "description": "Name/description of the leased asset or premises"},
            "asset_category": {
                "type": "string",
                "enum": ["Property", "Vehicle", "Plant & Machinery", "IT Equipment", "Furniture", "Other"],
            },
            "location": {"type": "string"},
            "commencement_date": {"type": "string", "description": "Lease commencement date, ISO format YYYY-MM-DD"},
            "lease_term_months": {"type": "integer"},
            "non_cancellable_period_months": {"type": "integer"},
            "renewal_option_months": {"type": "integer"},
            "payment_frequency": {"type": "string", "enum": ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUALLY"]},
            "payment_timing": {"type": "string", "enum": ["ARREARS", "ADVANCE"]},
            "base_payment_amount": {"type": "number"},
            "escalation_type": {"type": "string", "enum": ["NONE", "FIXED_PERCENT", "CUSTOM"]},
            "escalation_percent": {"type": "number", "description": "Plain percentage number, e.g. 5 for 5%, not 0.05"},
            "escalation_frequency_months": {"type": "integer"},
            "currency": {"type": "string"},
            "security_deposit_amount": {"type": "number"},
            "notes": {
                "type": "string",
                "description": "Any other clauses worth flagging (restoration obligations, GST, TDS, break clauses etc.)",
            },
            "warnings": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Any terms that are ambiguous, missing, or need human review",
            },
        },
        "required": [],
    },
}

SYSTEM_PROMPT = (
    "You are a lease accounting analyst extracting structured terms from a lease agreement "
    "for Ind AS 116 / IFRS 16 processing. Read the attached document carefully and call "
    "record_lease_terms with every field you can determine directly from the text. Leave a "
    "field out entirely if it is not stated in the document -- never guess or invent a value. "
    "Dates must be ISO format YYYY-MM-DD. Percentages (escalation) must be a plain number, "
    "e.g. 5 for 5%, not 0.05. Flag anything ambiguous or missing in `warnings`."
)

_ALLOWED_MEDIA_TYPES = {"application/pdf", "image/png", "image/jpeg", "image/webp"}


def extract_lease_terms(file_bytes: bytes, filename: str, media_type: str) -> dict:
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise HTTPException(503, "AI extraction is not configured (missing ANTHROPIC_API_KEY)")
    if media_type not in _ALLOWED_MEDIA_TYPES:
        raise HTTPException(400, "Upload a PDF or image (PNG/JPEG/WEBP) of the lease agreement.")

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    encoded = base64.standard_b64encode(file_bytes).decode("utf-8")

    block_type = "document" if media_type == "application/pdf" else "image"
    content_block = {
        "type": block_type,
        "source": {"type": "base64", "media_type": media_type, "data": encoded},
    }

    try:
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            tools=[EXTRACTION_TOOL],
            tool_choice={"type": "tool", "name": "record_lease_terms"},
            messages=[
                {
                    "role": "user",
                    "content": [
                        content_block,
                        {"type": "text", "text": f"Extract the lease terms from this document ({filename})."},
                    ],
                }
            ],
        )
    except anthropic.APIError as exc:
        raise HTTPException(502, f"AI extraction failed: {exc}") from exc

    for block in response.content:
        if block.type == "tool_use" and block.name == "record_lease_terms":
            return dict(block.input)

    raise HTTPException(502, "AI extraction did not return structured data")
