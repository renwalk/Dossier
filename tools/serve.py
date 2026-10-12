#!/usr/bin/env python3
"""Local dev server that disables caching entirely.

`python3 -m http.server` sends Last-Modified but no Cache-Control, so
browsers can still serve a stale cached response (heuristic freshness)
after a file changes on disk — especially for JS module scripts, which
browsers cache more aggressively. That produced confusing "my edit
isn't showing up" symptoms during development. This server adds
Cache-Control: no-store to every response so a plain reload always
gets the current file.

It's also threaded: the pages fire a dozen requests at once, and the
default one-at-a-time server occasionally dropped one ("Failed to fetch").

Usage: python3 tools/serve.py [port]  (default port 8123)
"""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(http.server.ThreadingHTTPServer):
    # The default listen backlog is 5, so a burst of simultaneous requests (the
    # pages fetch six section files plus styles and fonts at once) could have a
    # connection refused, which shows up as "Failed to fetch". Allow a long queue.
    request_queue_size = 128
    daemon_threads = True


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    http.server.test(HandlerClass=NoCacheHandler, ServerClass=Server, port=port)
