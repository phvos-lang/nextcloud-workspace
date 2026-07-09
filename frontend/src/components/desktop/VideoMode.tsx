import { useEffect, useRef, useState } from "react";
import { Loader2, Zap } from "lucide-react";

/**
 * WebCodecs beta viewer — decodes the session's raw H.264 stream
 * (/api/sessions/{id}/video) with VideoDecoder onto a canvas.
 *
 * View-only: input still goes through the VNC client; this mode is for
 * low-latency *watching* (monitoring dashboards, videos, presentations).
 *
 * Stream framing: the encoder emits AUD NALs (x264 aud=1, one slice per
 * frame), so access units are the bytes between successive AUD start codes.
 * SPS/PPS ride in front of each IDR; chunks containing an IDR are keyframes.
 */
export function VideoMode({ sessionId }: { sessionId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"connecting" | "playing" | "unsupported" | "error">(
    typeof window.VideoDecoder === "undefined" ? "unsupported" : "connecting",
  );

  useEffect(() => {
    if (typeof window.VideoDecoder === "undefined") return;
    const abort = new AbortController();
    let decoder: VideoDecoder | null = null;
    let stopped = false;

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const start = async () => {
      decoder = new VideoDecoder({
        output: (frame) => {
          if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
            canvas.width = frame.displayWidth;
            canvas.height = frame.displayHeight;
          }
          ctx.drawImage(frame, 0, 0);
          frame.close();
          setState((s) => (s === "connecting" ? "playing" : s));
        },
        error: () => setState("error"),
      });
      decoder.configure({ codec: "avc1.42E01E", optimizeForLatency: true });

      const resp = await fetch(`/api/sessions/${sessionId}/video`, { signal: abort.signal });
      if (!resp.ok || !resp.body) { setState("error"); return; }
      const reader = resp.body.getReader();

      // Accumulate bytes; split into access units on AUD NALs (type 9).
      let buf = new Uint8Array(0);
      let ts = 0;
      const AUD = 9, IDR = 5;

      const findAudPositions = (b: Uint8Array): number[] => {
        const out: number[] = [];
        for (let i = 0; i + 4 < b.length; i++) {
          // start code 00 00 00 01 or 00 00 01
          let o = -1;
          if (b[i] === 0 && b[i + 1] === 0 && b[i + 2] === 0 && b[i + 3] === 1) o = i + 4;
          else if (b[i] === 0 && b[i + 1] === 0 && b[i + 2] === 1) o = i + 3;
          if (o > 0 && o < b.length && (b[o] & 0x1f) === AUD) out.push(i);
        }
        return out;
      };

      const hasIdr = (b: Uint8Array): boolean => {
        for (let i = 0; i + 4 < b.length; i++) {
          let o = -1;
          if (b[i] === 0 && b[i + 1] === 0 && b[i + 2] === 0 && b[i + 3] === 1) o = i + 4;
          else if (b[i] === 0 && b[i + 1] === 0 && b[i + 2] === 1) o = i + 3;
          if (o > 0 && o < b.length && (b[o] & 0x1f) === IDR) return true;
        }
        return false;
      };

      let sawKey = false;
      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;
        const merged = new Uint8Array(buf.length + value.length);
        merged.set(buf); merged.set(value, buf.length);
        buf = merged;

        const auds = findAudPositions(buf);
        // Each complete AU spans from one AUD to the next; keep the tail.
        while (auds.length >= 2) {
          const start = auds.shift()!;
          const end = auds[0];
          const au = buf.subarray(start, end);
          const key = hasIdr(au);
          if (key) sawKey = true;
          if (sawKey && decoder!.state === "configured") {
            decoder!.decode(new EncodedVideoChunk({
              type: key ? "key" : "delta",
              timestamp: ts,
              data: au,
            }));
            ts += 33_333; // ~30 fps
          }
        }
        if (auds.length === 1) buf = buf.slice(auds[0]);
        else if (buf.length > 4 * 1024 * 1024) buf = new Uint8Array(0); // safety valve
      }
    };

    start().catch(() => { if (!stopped) setState("error"); });

    return () => {
      stopped = true;
      abort.abort();
      try { decoder?.close(); } catch { /* already closed */ }
    };
  }, [sessionId]);

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black">
      <canvas ref={canvasRef} className="max-h-full max-w-full object-contain" />
      {state !== "playing" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/60">
          {state === "connecting" && <><Loader2 className="h-6 w-6 animate-spin" /><p className="text-sm">Starting video stream…</p></>}
          {state === "unsupported" && <p className="text-sm">WebCodecs is not supported by this browser</p>}
          {state === "error" && <p className="text-sm">Video stream unavailable — is this a desktop session?</p>}
        </div>
      )}
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[11px] text-amber-300">
        <Zap className="h-3 w-3" />
        Video mode (beta) — view only, input disabled
      </div>
    </div>
  );
}
