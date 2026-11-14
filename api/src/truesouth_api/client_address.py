"""Resolve rate-limit addresses only through explicitly trusted peers."""
import ipaddress
import os

from fastapi import Request


def _address(value):
    address = ipaddress.ip_address(value)
    return getattr(address, "ipv4_mapped", None) or address


def trusted_proxies():
    value = os.environ.get("TRUESOUTH_TRUSTED_PROXIES", "")
    if not value.strip():
        return ()
    networks = []
    for entry in value.split(","):
        item = entry.strip()
        try:
            network = ipaddress.ip_network(item, strict=True)
            if network.version == 6 and network.prefixlen >= 96 and network.network_address.ipv4_mapped is not None:
                network = ipaddress.ip_network((network.network_address.ipv4_mapped, network.prefixlen - 96), strict=True)
            if network.prefixlen < (24 if network.version == 4 else 64):
                raise ValueError("network is wider than the allowed minimum prefix")
        except ValueError as error:
            raise ValueError(f"Invalid TRUESOUTH_TRUSTED_PROXIES entry {item!r}: {error}") from error
        networks.append(network)
    return tuple(networks)


def client_address(request: Request, proxies) -> str:
    peer = request.client.host if request.client else "unknown"
    try:
        address = _address(peer)
        if not any(address in network for network in proxies):
            return peer
        forwarded = request.headers.getlist("x-forwarded-for")
        if not forwarded:
            return peer
        return str(_address(forwarded[-1].split(",")[-1].strip()))
    except ValueError:
        return peer
