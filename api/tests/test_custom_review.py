import json
from time import perf_counter
from threading import Event, Thread

import pytest
from fastapi.testclient import TestClient

from test_custom import synthetic, request, entry, wait_state
from truesouth_api.jobs import Computer, Jobs, Rejected, site_id
from truesouth_api.main import create_app


@pytest.mark.parametrize('body', [
    b'{"lat_deg":NaN,"lon_deg":0}', b'{"lat_deg":Infinity,"lon_deg":0}',
    b'{"lat_deg":-Infinity,"lon_deg":0}', b'{"lat_deg":1e309,"lon_deg":0}',
    b'{"lat_deg":0,"lon_deg":NaN}', b'{"lat_deg":0,"lon_deg":Infinity}',
    b'{"lat_deg":0,"lon_deg":-Infinity}', b'{"lat_deg":0,"lon_deg":1e309}',
    b'{"lat_deg":"-89.2","lon_deg":0}', b'{"lat_deg":true,"lon_deg":0}',
    b'{"lat_deg":0,"lon_deg":false}', b'{"lat_deg":0,"lon_deg":"2"}',
    b'{"lat_deg":{},"lon_deg":0}', b'{"lat_deg":[],"lon_deg":0}',
    b'{"lat_deg":0,"lon_deg":0,"name":42}', b'{"lat_deg":0,"lon_deg":0,"name":true}',
    b'{"lat_deg":0,"lon_deg":0,"name":{}}', b'{"lat_deg":0,"lon_deg":0,"name":[]}',
    b'{"lat_deg":0}', b'{}', b'[]', b'null', b'', b'{broken',
    b'{"lat_deg":0,"lon_deg":0,"SECRET_CLIENT_FIELD":"SECRET_PAYLOAD"}',
])
def test_invalid_bodies_are_plain_422(synthetic, body):
    derived, prepared, cache = synthetic
    with TestClient(create_app(derived=derived, prepared=prepared, cache=cache), raise_server_exceptions=False) as client:
        response = client.post('/api/sites/custom', content=body, headers={'Content-Type':'application/json'})
        assert response.status_code == 422
        data = response.json()
        assert set(data) == {'message', 'fields'}
        assert data['fields']
        assert all(set(field) == {'field', 'message'} for field in data['fields'])
        assert 'SECRET' not in response.text
        assert 'input' not in response.text
        if b'lat_deg' in body and b'lon_deg' in body and b'name' not in body and b'lat_deg":0' not in body:
            assert data['fields'][0]['message'] == 'Latitude must be a number from −90 to 90.'
