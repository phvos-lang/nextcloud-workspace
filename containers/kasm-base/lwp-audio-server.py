#!/usr/bin/env python3
"""Per-connection Opus/Ogg audio server for LWP desktop sound.

Each GET spawns a fresh ffmpeg capturing the PulseAudio sink monitor and streams
Ogg/Opus; ffmpeg is killed when the client disconnects. Unlike `ffmpeg -listen 1`
(single-shot, dies into a dead socket), this handles reconnects and multiple
clients cleanly."""
import subprocess
from http.server import BaseHTTPRequestHandler
from socketserver import ThreadingTCPServer

FFMPEG = [
    "ffmpeg", "-nostdin", "-loglevel", "error",
    "-fflags", "nobuffer",
    "-f", "pulse", "-i", "default_sink.monitor", "-ac", "2",
    "-c:a", "libopus", "-b:a", "96k", "-application", "lowdelay",
    "-frame_duration", "20", "-flush_packets", "1",
    # The Ogg muxer batches up to 1s of audio into a page by default — a large,
    # fixed latency source. Force ~20ms pages so audio reaches the browser
    # promptly (page_duration is in microseconds).
    "-page_duration", "20000",
    "-f", "ogg", "pipe:1",
]


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/ogg")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        self.end_headers()
        proc = subprocess.Popen(FFMPEG, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        try:
            while True:
                chunk = proc.stdout.read(8192)
                if not chunk:
                    break
                self.wfile.write(chunk)
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            try:
                proc.kill()
                proc.wait(timeout=2)
            except Exception:
                pass

    def log_message(self, *args):
        pass


class Server(ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    Server(("0.0.0.0", 8081), Handler).serve_forever()
