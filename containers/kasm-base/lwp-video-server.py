#!/usr/bin/env python3
"""Per-connection raw H.264 server for the WebCodecs beta viewer (:8082).

Each GET spawns a fresh ffmpeg capturing the X display and streams Annex-B
H.264; ffmpeg is killed when the client disconnects. Mirrors the audio server —
`ffmpeg -listen 1` is single-shot and dies into a dead socket (the backend relay
then reads nothing), so we run our own HTTP server and spawn ffmpeg per client.

Encoder notes for the browser VideoDecoder:
  baseline profile   broadest WebCodecs support
  aud=1              AUD NALs delimit access units → trivial JS framing
  sliced-threads=0   one slice per frame → one NAL group per access unit
"""
import subprocess
from http.server import BaseHTTPRequestHandler
from socketserver import ThreadingTCPServer

DISPLAY = ":1"


def _geometry() -> str:
    try:
        out = subprocess.check_output(["xdpyinfo", "-display", DISPLAY], text=True)
        for line in out.splitlines():
            if "dimensions:" in line:
                return line.split()[1]  # e.g. 1280x720
    except Exception:
        pass
    return "1280x720"


def _ffmpeg_cmd() -> list[str]:
    return [
        "ffmpeg", "-nostdin", "-loglevel", "error",
        "-f", "x11grab", "-framerate", "30", "-video_size", _geometry(),
        "-i", DISPLAY,
        "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency",
        "-profile:v", "baseline", "-pix_fmt", "yuv420p", "-g", "60",
        "-x264-params", "sliced-threads=0:aud=1",
        "-flush_packets", "1",
        "-f", "h264", "pipe:1",
    ]


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "video/h264")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        self.end_headers()
        proc = subprocess.Popen(_ffmpeg_cmd(), stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
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
    Server(("0.0.0.0", 8082), Handler).serve_forever()
