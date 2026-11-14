# 0017. Trusted proxy for client addresses

**Decision (2026-11-14, S13b).** Keep Uvicorn proxy processing disabled and
accept the rightmost X-Forwarded-For address only from an explicitly trusted socket
peer, as described in [architecture](../architecture.md#client-addresses-and-reverse-proxies).
Production nginx replaces the header and has a fixed address on a private network.

**Why.** Visitors need separate custom-site limits behind nginx, while direct clients
must not choose their own rate-limit identity.

**Rejected.** Uvicorn `--proxy-headers` and `--forwarded-allow-ips` rewrite the peer
before the application can enforce this narrow rule. Nginx-only rate limiting would
move the application limit out of the API and leave other deployments unprotected.

**Risk.** A trusted range that includes untrusted clients lets them spoof identities;
trust only the controlled proxy address and restrict network access accordingly.
