import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from truesouth_api.client_address import client_address, trusted_proxies
from truesouth_api.jobs import Jobs
from truesouth_api.main import create_app
from test_custom import entry


@pytest.mark.parametrize("setting,peer,header,expected", [
    ("", "192.0.2.10", "198.51.100.1", "192.0.2.10"),
    ("192.0.2.11", "192.0.2.10", "198.51.100.1", "192.0.2.10"),
    ("192.0.2.10", "192.0.2.10", "198.51.100.1", "198.51.100.1"),
    ("192.0.2.0/24", "192.0.2.10", "198.51.100.1, 203.0.113.4", "203.0.113.4"),
    ("192.0.2.10", "192.0.2.10", "198.51.100.1, bad", "192.0.2.10"),
    ("2001:db8::/32", "2001:db8::1", "2001:db8:1::2", "2001:db8:1::2"),
    ("2001:db8::1", "2001:db8::1", "[2001:db8::2]:80", "2001:db8::1"),
    ("192.0.2.10", "192.0.2.10", None, "192.0.2.10"),
])
def test_addresses(monkeypatch, setting, peer, header, expected):
    monkeypatch.setenv("TRUESOUTH_TRUSTED_PROXIES", setting)
    headers = [] if header is None else [(b"x-forwarded-for", header.encode())]
    request = Request({"type": "http", "headers": headers, "client": (peer, 42)})
    assert client_address(request, trusted_proxies()) == expected


def test_separate_limits_through_proxy(monkeypatch, tmp_path):
    monkeypatch.setenv("TRUESOUTH_TRUSTED_PROXIES", "192.0.2.0/24")
    class Sphere:
        def tier(self, body): return "sphere"
        def __call__(self, body, tier): return entry(body)
    jobs = Jobs(tmp_path, Sphere())
    with TestClient(create_app(cache=tmp_path, jobs=jobs), client=("192.0.2.10", 42)) as client:
        for i in range(6):
            assert client.post("/api/sites/custom", json={"lat_deg": 0, "lon_deg": i}, headers={"X-Forwarded-For": "198.51.100.1"}).status_code == 200
        assert client.post("/api/sites/custom", json={"lat_deg": 0, "lon_deg": 7}, headers={"X-Forwarded-For": "198.51.100.1"}).status_code == 429
        assert client.post("/api/sites/custom", json={"lat_deg": 0, "lon_deg": 8}, headers={"X-Forwarded-For": "198.51.100.2"}).status_code == 200
