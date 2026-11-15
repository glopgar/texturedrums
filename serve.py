#!/usr/bin/env python3
"""Static server for the synth that disables browser caching (so edits always show up)."""
import http.server, sys

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8057
print(f'TextureDrums: http://localhost:{port}/')
http.server.ThreadingHTTPServer(('', port), Handler).serve_forever()
