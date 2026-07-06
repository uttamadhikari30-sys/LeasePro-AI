from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError

from .config import get_settings
from .routers import leases, lessors, organizations, reports, security_deposits

settings = get_settings()

app = FastAPI(
    title="LeasePro AI API",
    description="Ind AS 116 / IFRS 16 lease accounting engine and REST API.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(APIError)
async def postgrest_api_error_handler(request: Request, exc: APIError):
    # PGRST116 = ".single()"/".maybe_single()" found 0 (or >1) rows -- treat as
    # a normal 404 rather than a 500, so the CORS middleware still wraps a
    # clean handled response instead of the browser seeing a bare failure.
    if exc.code == "PGRST116":
        return JSONResponse(status_code=404, content={"detail": "Resource not found"})
    return JSONResponse(status_code=400, content={"detail": exc.message})

app.include_router(organizations.router)
app.include_router(lessors.router)
app.include_router(leases.router)
app.include_router(security_deposits.router)
app.include_router(reports.router)


@app.get("/health")
def health():
    return {"status": "ok"}
