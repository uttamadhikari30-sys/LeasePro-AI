"""Vercel serverless entrypoint -- exposes the FastAPI ASGI app.

Vercel's @vercel/python runtime imports the module-level ``app`` and serves
it; the actual FastAPI app lives in ../app/main.py.
"""
from app.main import app  # noqa: F401
