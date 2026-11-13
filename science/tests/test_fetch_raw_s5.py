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
