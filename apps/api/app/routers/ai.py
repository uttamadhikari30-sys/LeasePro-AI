from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..auth import CurrentUser, get_current_user
from ..schemas import ExtractedLeaseFields, LeaseExtractionResponse
from ..services import ai_extraction_service

router = APIRouter(prefix="/ai", tags=["ai"])

_ALLOWED_CONTENT_TYPES = {"application/pdf", "image/png", "image/jpeg", "image/webp"}
_MAX_BYTES = 15 * 1024 * 1024


@router.post("/extract-lease", response_model=LeaseExtractionResponse)
async def extract_lease(
    file: UploadFile = File(...),
    _user: CurrentUser = Depends(get_current_user),
):
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(400, "Upload a PDF or image (PNG/JPEG/WEBP) of the lease agreement.")

    contents = await file.read()
    if len(contents) > _MAX_BYTES:
        raise HTTPException(413, "File too large (max 15 MB).")

    raw = ai_extraction_service.extract_lease_terms(contents, file.filename or "lease", file.content_type)
    warnings = raw.pop("warnings", [])
    fields = ExtractedLeaseFields(**{k: v for k, v in raw.items() if k in ExtractedLeaseFields.model_fields})
    return LeaseExtractionResponse(fields=fields, warnings=warnings)
