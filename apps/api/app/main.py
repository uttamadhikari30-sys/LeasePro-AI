import re

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError

from . import dns_patch
from .config import get_settings
from .routers import ai, leases, lessors, organizations, reports, security_deposits

# Vercel's serverless resolver can't resolve the Supabase host; patch DNS to
# fall back to DNS-over-HTTPS before any Supabase client is created.
dns_patch.install()

settings = get_settings()

_CORS_ORIGIN_RE = re.compile(
    r"https://leasepro-ai(-[a-z0-9]+)*(-uttamadhikari30-sys-projects)?\.vercel\.app"
)


def _cors_headers(request: Request) -> dict:
    """CORS headers for an error response. App-level exception handlers run in
    Starlette's outermost ServerErrorMiddleware, *outside* CORSMiddleware, so
    error responses would otherwise reach the browser with no CORS headers and
    be dropped as an opaque "Failed to fetch". Set them explicitly here."""
    origin = request.headers.get("origin", "")
    if origin and (origin in settings.allowed_origins_list or _CORS_ORIGIN_RE.fullmatch(origin)):
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Vary": "Origin",
        }
    return {}

app = FastAPI(
    title="LeasePro AI API",
    description="Ind AS 116 / IFRS 16 lease accounting engine and REST API.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    # Covers the production domain and every Vercel preview deployment
    # (e.g. leasepro-ai-hq1ka4n17-uttamadhikari30-sys-projects.vercel.app)
    # without needing ALLOWED_ORIGINS updated on every deploy.
    allow_origin_regex=r"https://leasepro-ai(-[a-z0-9]+)*(-uttamadhikari30-sys-projects)?\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(APIError)
async def postgrest_api_error_handler(request: Request, exc: APIError):
    # PGRST116 = ".single()"/".maybe_single()" found 0 (or >1) rows -- treat as
    # a normal 404 rather than a 500.
    if exc.code == "PGRST116":
        return JSONResponse(status_code=404, content={"detail": "Resource not found"}, headers=_cors_headers(request))
    return JSONResponse(status_code=400, content={"detail": exc.message}, headers=_cors_headers(request))


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(exc).__name__}: {exc}"},
        headers=_cors_headers(request),
    )

app.include_router(organizations.router)
app.include_router(lessors.router)
app.include_router(leases.router)
app.include_router(security_deposits.router)
app.include_router(reports.router)
app.include_router(ai.router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/debug/conn")
def debug_conn():
    """Temporary diagnostic: probe how the serverless runtime can reach
    Supabase, to pin down the ConnectError [Errno 16] failure. Remove once
    the connection path is fixed."""
    import httpx

    url = settings.supabase_url.rstrip("/") + "/rest/v1/"
    key = settings.supabase_anon_key
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    results = {}

    def probe(name, fn):
        try:
            r = fn()
            results[name] = {"ok": True, "status": r.status_code}
        except Exception as exc:  # noqa: BLE001
            results[name] = {"ok": False, "error": f"{type(exc).__name__}: {exc}"}

    from . import dns_patch

    results["patch_installed"] = dns_patch._installed
    results["doh_resolve"] = list(dns_patch._resolve_via_doh(httpx.URL(url).host))

    # With the DNS-over-HTTPS patch installed, these should now succeed.
    probe("httpx_supabase", lambda: httpx.get(url, headers=headers, timeout=10))

    def supabase_probe():
        from supabase import create_client

        c = create_client(settings.supabase_url, settings.supabase_anon_key)
        n = len(c.table("organizations").select("id").limit(1).execute().data)
        return type("R", (), {"status_code": f"ok ({n} rows)"})

    probe("supabase_sdk", supabase_probe)
    return results
