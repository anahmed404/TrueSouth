"""Resolve rate-limit addresses only through explicitly trusted peers."""
import ipaddress
import os

from fastapi import Request


def trusted_proxies():
    value = os.environ.get("TRUESOUTH_TRUSTED_PROXIES", "")
    return tuple(ipaddress.ip_network(item.strip(), strict=False) for item in value.split(",") if item.strip())


def client_address(request: Request, proxies) -> str:
    peer = request.client.host if request.client else "unknown"
    try:
        address = ipaddress.ip_address(peer)
        if not any(address in network for network in proxies):
            return peer
        forwarded = request.headers.getlist("x-forwarded-for")
        if not forwarded:
            return peer
        return str(ipaddress.ip_address(forwarded[-1].split(",")[-1].strip()))
    except ValueError:
        return peer
