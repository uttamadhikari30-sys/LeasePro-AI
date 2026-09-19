"""Work around Vercel serverless functions failing to resolve the Supabase
hostname via the system resolver.

On Vercel, `socket.getaddrinfo("<ref>.supabase.co", ...)` fails (EAI_NONAME /
"[Errno 16] Device or resource busy") even though the host has valid public A
records and other hosts (example.com) resolve fine. Plain HTTPS still works, so
we resolve the Supabase host over DNS-over-HTTPS and monkeypatch
`socket.getaddrinfo` to return that IP. httpx/PostgREST then connect to the
Cloudflare edge IP with TLS SNI + Host still set to the hostname, so Cloudflare
routes the request to the correct Supabase project.

The patch only intervenes when the real resolver fails for the specific
Supabase host, so local development (where system DNS works) is unaffected.
"""
import socket
from functools import lru_cache
from urllib.parse import urlparse

from .config import get_settings

_original_getaddrinfo = socket.getaddrinfo
_installed = False

# Cloudflare anycast IPs that front the Supabase host. Supabase sits behind
# Cloudflare, which routes by TLS SNI, so connecting to any of these with the
# hostname as SNI reaches the right project. Used as a fallback when neither
# the system resolver nor DoH can resolve the name from the Vercel function's
# network (AWS us-east-1 can't resolve *.supabase.co here, though it connects
# to Cloudflare fine -- example.com works).
_FALLBACK_IPS = ("104.18.38.10", "172.64.149.246")


def _supabase_host() -> str:
    return (urlparse(get_settings().supabase_url).hostname or "").lower()


@lru_cache(maxsize=16)
def _resolve_via_doh(host: str) -> tuple[str, ...]:
    """Resolve A records for `host` via DNS-over-HTTPS. Uses httpx (bundled
    certifi CA -- urllib's system-CA verification fails on Vercel)."""
    import httpx

    providers = (
        f"https://dns.google/resolve?name={host}&type=A",
        f"https://cloudflare-dns.com/dns-query?name={host}&type=A",
    )
    for url in providers:
        try:
            r = httpx.get(url, headers={"accept": "application/dns-json"}, timeout=8)
            data = r.json()
            ips = tuple(a["data"] for a in data.get("Answer", []) if a.get("type") == 1)
            if ips:
                return ips
        except Exception:  # noqa: BLE001 -- fall through to the next provider
            continue
    return ()


@lru_cache(maxsize=16)
def _resolve(host: str) -> tuple[str, ...]:
    return _resolve_via_doh(host) or _FALLBACK_IPS


def install() -> None:
    global _installed
    if _installed:
        return
    target = _supabase_host()
    if not target:
        return

    def patched_getaddrinfo(host, port, *args, **kwargs):
        try:
            return _original_getaddrinfo(host, port, *args, **kwargs)
        except OSError:
            if isinstance(host, (bytes, bytearray)):
                host = host.decode()
            if host and host.lower() == target:
                ips = _resolve(host.lower())
                if ips:
                    p = port if isinstance(port, int) else 0
                    return [
                        (socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", (ip, p))
                        for ip in ips
                    ]
            raise

    socket.getaddrinfo = patched_getaddrinfo
    _installed = True
