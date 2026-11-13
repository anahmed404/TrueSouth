import httpx
import pytest

from truesouth.commands.fetch_raw import Download, check, download


def test_check_and_resume(tmp_path):
    data = b'abcdefghij'
    item = Download('terrain', 'https://example.test/map', 'map.tif')
    requests = []
    def handler(request):
        requests.append(request)
        if request.method == 'HEAD':
            return httpx.Response(200, headers={'content-length': str(len(data))})
        assert request.headers['range'] == 'bytes=4-'
        return httpx.Response(206, headers={'content-range': 'bytes 4-9/10'}, content=data[4:])
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        assert check(client, [item]) == {'map.tif': 10}
        (tmp_path / 'map.tif.part').write_bytes(data[:4])
        download(client, item, 10, tmp_path)
        assert (tmp_path / 'map.tif').read_bytes() == data
        download(client, item, 10, tmp_path)
        assert len(requests) == 2


def test_missing_and_size_mismatch(tmp_path):
    item = Download('terrain', 'https://example.test/map', 'map.tif')
    with httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(404))) as client:
        with pytest.raises(RuntimeError, match='checks failed'):
            check(client, [item])
    with httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, content=b'bad'))) as client:
        with pytest.raises(RuntimeError, match='size mismatch'):
            download(client, item, 5, tmp_path)
        assert not (tmp_path / 'map.tif').exists()


def test_a_wrong_body_is_refused_before_it_is_written(tmp_path):
    item = Download('terrain', 'https://example.test/map', 'map.tif')
    # An error page with a success status must not become a partial file.
    page = lambda r: httpx.Response(200, headers={'content-type': 'text/html'}, content=b'<html>')
    with httpx.Client(transport=httpx.MockTransport(page)) as client:
        with pytest.raises(RuntimeError, match='web page'):
            download(client, item, 10, tmp_path)
    assert not (tmp_path / 'map.tif.part').exists()
    assert not (tmp_path / 'map.tif').exists()
    # Nor must a body of the wrong length: this was saved as b'short' and later extended.
    short = lambda r: httpx.Response(200, content=b'short')
    with httpx.Client(transport=httpx.MockTransport(short)) as client:
        with pytest.raises(RuntimeError, match='size mismatch'):
            download(client, item, 10, tmp_path)
    assert not (tmp_path / 'map.tif.part').exists()
    assert not (tmp_path / 'map.tif').exists()


def test_server_that_ignores_the_range_leaves_the_partial_alone(tmp_path):
    data = b'abcdefghij'
    item = Download('terrain', 'https://example.test/map', 'map.tif')
    (tmp_path / 'map.tif.part').write_bytes(data[:4])
    whole = lambda r: httpx.Response(200, content=data)
    with httpx.Client(transport=httpx.MockTransport(whole)) as client:
        with pytest.raises(RuntimeError, match='resume range'):
            download(client, item, 10, tmp_path)
    assert (tmp_path / 'map.tif.part').read_bytes() == data[:4]
    assert not (tmp_path / 'map.tif').exists()
