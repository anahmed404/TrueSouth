"""Bound custom-site request bytes before FastAPI reads or parses JSON."""
from starlette.responses import JSONResponse


class CustomBodyLimit:
    def __init__(self, app, limit=4096):
        self.app, self.limit = app, limit

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or scope.get('method') != 'POST' or scope.get('path') != '/api/sites/custom':
            return await self.app(scope, receive, send)
        async def refuse():
            await JSONResponse({'message': f'Custom-site requests must be at most {self.limit} bytes.'},
                               status_code=413)(scope, receive, send)
        for key, value in scope.get('headers', []):
            if key.lower() == b'content-length':
                try:
                    if int(value) > self.limit:
                        return await refuse()
                except ValueError:
                    pass
        body = bytearray()
        while True:
            message = await receive()
            if message['type'] == 'http.disconnect':
                return
            chunk = message.get('body', b'')
            if len(body) + len(chunk) > self.limit:
                return await refuse()
            body.extend(chunk)
            if not message.get('more_body', False):
                break
        delivered = False
        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {'type':'http.request', 'body':bytes(body), 'more_body':False}
            return await receive()
        await self.app(scope, replay, send)
