"""Vercel serverless entrypoint -- exposes the FastAPI ASGI app.

Deployed via the classic @vercel/python builder (see vercel.json `builds`),
which runs as a standard serverless function with working outbound DNS. The
native FastAPI framework preset was dropping outbound connections with
"[Errno 16] Device or resource busy" (a serverless DNS-resolution failure).
"""
from app.main import app  # noqa: F401
