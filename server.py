#!/usr/bin/env python3
"""LAN media server for the language-learning player.

Serves the player UI + a media folder, so phone and desktop on the same
Wi-Fi share ONE directory (option A).

Usage (from this folder):

    python3 server.py 8000 medium_level
    python3 server.py --port 8000 --media medium_level
    python3 server.py 8000                 # media defaults to ./medium_level

Do NOT use `python3 -m http.server` — that is a different tool and does
not accept a trailing directory argument.

Then open:
    http://127.0.0.1:8000/player0.1.html
    http://<lan-ip>:8000/player0.1.html   (phone on same Wi-Fi)
"""

from __future__ import annotations

import argparse
import json
import os
import re
import socket
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import quote, unquote, urlparse

RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")

AUDIO_EXTS = {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"}
SUB_EXTS = {".lrc": "lrc", ".srt": "srt"}

# Player UI lives next to this script
WEB_ROOT = os.path.dirname(os.path.abspath(__file__))


def guess_content_type(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    return {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".m4a": "audio/mp4",
        ".flac": "audio/flac",
        ".aac": "audio/aac",
        ".lrc": "text/plain; charset=utf-8",
        ".srt": "text/plain; charset=utf-8",
        ".txt": "text/plain; charset=utf-8",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
    }.get(ext, "application/octet-stream")


def safe_join(root: str, rel: str) -> str | None:
    """Join and ensure the result stays inside root."""
    rel = rel.lstrip("/").replace("\\", "/")
    # block path traversal
    parts = [p for p in rel.split("/") if p not in ("", ".", "..")]
    full = os.path.abspath(os.path.join(root, *parts))
    root_abs = os.path.abspath(root)
    if full == root_abs or full.startswith(root_abs + os.sep):
        return full
    return None


def scan_media_tree(media_root: str, name: str) -> dict:
    """Build a JSON tree of audio + subtitle files under media_root."""

    def walk(dir_path: str, display_name: str) -> dict:
        node = {"name": display_name, "children": {}, "tracks": []}
        try:
            entries = list(os.scandir(dir_path))
        except OSError:
            return node

        # group by basename within this folder
        groups: dict[str, dict] = {}
        subdirs = []

        for ent in entries:
            try:
                if ent.is_dir(follow_symlinks=False):
                    subdirs.append(ent.name)
                    continue
                if not ent.is_file(follow_symlinks=False):
                    continue
            except OSError:
                continue

            fname = ent.name
            dot = fname.rfind(".")
            if dot <= 0:
                continue
            base, ext = fname[:dot], fname[dot:].lower()
            if ext not in AUDIO_EXTS and ext not in SUB_EXTS:
                continue

            g = groups.setdefault(base, {"audio": None, "sub": None, "subType": None})
            if ext in AUDIO_EXTS:
                g["audio"] = fname
            elif ext in SUB_EXTS:
                # prefer LRC
                if g["sub"] is None or SUB_EXTS[ext] == "lrc":
                    if g["subType"] != "lrc" or SUB_EXTS[ext] == "lrc":
                        g["sub"] = fname
                        g["subType"] = SUB_EXTS[ext]

        for base, g in groups.items():
            if not g["audio"]:
                continue
            # path relative to media root for URLs
            rel_dir = os.path.relpath(dir_path, media_root)
            if rel_dir == ".":
                rel_dir = ""
            audio_rel = (rel_dir + "/" if rel_dir else "") + g["audio"]
            sub_rel = ((rel_dir + "/" if rel_dir else "") + g["sub"]) if g["sub"] else None
            node["tracks"].append({
                "title": base,
                "audioUrl": "/media/" + quote(audio_rel.replace(os.sep, "/")),
                "subUrl": ("/media/" + quote(sub_rel.replace(os.sep, "/"))) if sub_rel else None,
                "subType": g["subType"],
                "folderPath": rel_dir.replace(os.sep, "/"),
                "relPath": audio_rel.replace(os.sep, "/"),
            })

        node["tracks"].sort(key=lambda t: t["title"])
        for dname in sorted(subdirs):
            node["children"][dname] = walk(os.path.join(dir_path, dname), dname)
        return node

    return walk(media_root, name)


class PlayerHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    media_root = WEB_ROOT
    media_name = "media"

    def log_message(self, fmt, *args):
        msg = fmt % args
        if "favicon" in msg:
            return
        sys.stderr.write("%s - %s\n" % (self.address_string(), msg))

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except (ConnectionResetError, BrokenPipeError, TimeoutError):
            self.close_connection = True

    def do_POST(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if path == "/api/transcribe":
            return self._handle_transcribe()
        return self._send_json({"ok": False, "error": "unknown api"}, 404)

    def _handle_transcribe(self):
        """Run s2t.py on a media file (whisper-cli) and write .lrc next to it."""
        import subprocess

        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return self._send_json({"ok": False, "error": "invalid JSON"}, 400)

        rel = (payload.get("path") or payload.get("relPath") or "").strip()
        fmt = (payload.get("format") or "srt").lower()
        force = bool(payload.get("force"))
        if fmt not in ("lrc", "srt", "txt", "vtt"):
            fmt = "srt"
        if not rel:
            return self._send_json({"ok": False, "error": "missing path"}, 400)

        audio_path = safe_join(self.media_root, rel)
        if not audio_path or not os.path.isfile(audio_path):
            return self._send_json({"ok": False, "error": "audio not found"}, 404)

        base, _ext = os.path.splitext(audio_path)
        out_path = f"{base}.{fmt}"
        had_existing = os.path.isfile(out_path) and os.path.getsize(out_path) > 0

        # Without force, keep old behavior only when caller asks to skip
        if had_existing and not force and payload.get("skipIfExists"):
            rel_out = os.path.relpath(out_path, self.media_root).replace(os.sep, "/")
            return self._send_json({
                "ok": True,
                "skipped": True,
                "message": "字幕已存在",
                "subUrl": "/media/" + quote(rel_out),
                "subType": fmt if fmt in ("lrc", "srt") else None,
            })

        # Force re-transcribe: remove stale subtitle so whisper rewrites it
        if had_existing and force:
            try:
                os.remove(out_path)
            except OSError as err:
                return self._send_json({
                    "ok": False,
                    "error": f"无法覆盖旧字幕: {err}",
                }, 500)

        s2t = os.path.join(WEB_ROOT, "s2t.py")
        if not os.path.isfile(s2t):
            return self._send_json({"ok": False, "error": "s2t.py not found"}, 500)

        py = sys.executable or "python3"
        cmd = [py, s2t, audio_path, fmt]
        try:
            proc = subprocess.run(
                cmd,
                cwd=WEB_ROOT,
                capture_output=True,
                text=True,
                timeout=900,
            )
        except subprocess.TimeoutExpired:
            return self._send_json({"ok": False, "error": "转录超时（15 分钟）"}, 504)
        except OSError as err:
            return self._send_json({"ok": False, "error": str(err)}, 500)

        if proc.returncode != 0 or not (os.path.isfile(out_path) and os.path.getsize(out_path) > 0):
            tail = (proc.stderr or proc.stdout or "")[-500:]
            return self._send_json({
                "ok": False,
                "error": f"转录失败 (code {proc.returncode})",
                "detail": tail,
            }, 500)

        rel_out = os.path.relpath(out_path, self.media_root).replace(os.sep, "/")
        return self._send_json({
            "ok": True,
            "skipped": False,
            "retranscribed": had_existing,
            "message": "重新转录完成" if had_existing else "转录完成",
            "subUrl": "/media/" + quote(rel_out) + "?t=" + str(int(os.path.getmtime(out_path))),
            "subType": fmt if fmt in ("lrc", "srt") else None,
            "stdout": (proc.stdout or "")[-300:],
        })

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        if path in ("/", "/index.html", "/player0.1.html"):
            for name in ("index.html", "player0.1.html"):
                candidate = os.path.join(WEB_ROOT, name)
                if os.path.isfile(candidate):
                    return self._send_file(candidate)
        if path == "/api/tree":
            return self._send_tree()
        if path.startswith("/media/"):
            rel = path[len("/media/"):]
            full = safe_join(self.media_root, rel)
            if not full or not os.path.isfile(full):
                return self._send_error(404, "Media not found")
            return self._send_file(full, allow_range=True)
        if path.startswith("/api/"):
            return self._send_json({"error": "unknown api"}, 404)

        # static player assets from web root
        full = safe_join(WEB_ROOT, path.lstrip("/"))
        if full and os.path.isfile(full):
            return self._send_file(full, allow_range=True)
        if full and os.path.isdir(full):
            index = os.path.join(full, "index.html")
            if os.path.isfile(index):
                return self._send_file(index)
        return self._send_error(404, "Not found")

    def _send_json(self, obj, status=200):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def _send_tree(self):
        try:
            tree = scan_media_tree(self.media_root, self.media_name)
            self._send_json({
                "ok": True,
                "rootName": self.media_name,
                "mediaRoot": self.media_root,
                "tree": tree,
            })
        except Exception as err:  # noqa: BLE001
            self._send_json({"ok": False, "error": str(err)}, 500)

    def _send_error(self, code, message):
        self._send_json({"ok": False, "error": message}, code)

    def _send_file(self, filepath: str, allow_range: bool = False):
        if not os.path.isfile(filepath):
            return self._send_error(404, "Not found")

        ctype = guess_content_type(filepath)
        try:
            f = open(filepath, "rb")
        except OSError:
            return self._send_error(404, "Cannot open file")

        fs = os.fstat(f.fileno())
        size = fs.st_size
        range_header = self.headers.get("Range") if allow_range else None

        if not range_header:
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(size))
            if allow_range:
                self.send_header("Accept-Ranges", "bytes")
            self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            # body
            try:
                while True:
                    chunk = f.read(64 * 1024)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
            except (ConnectionResetError, BrokenPipeError):
                pass
            finally:
                f.close()
            return

        m = RANGE_RE.match(range_header.strip())
        if not m:
            f.close()
            return self._send_error(400, "Invalid Range")

        start_s, end_s = m.group(1), m.group(2)
        if start_s == "" and end_s == "":
            f.close()
            return self._send_error(400, "Invalid Range")

        if start_s == "":
            length = int(end_s)
            start = max(0, size - length)
            end = size - 1
        else:
            start = int(start_s)
            end = int(end_s) if end_s != "" else size - 1

        if start >= size or start < 0 or end < start:
            f.close()
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        end = min(end, size - 1)
        length = end - start + 1

        self.send_response(206)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()

        try:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)
        except (ConnectionResetError, BrokenPipeError):
            pass
        finally:
            f.close()


def lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        try:
            return socket.gethostbyname(socket.gethostname())
        except OSError:
            return "127.0.0.1"


def main():
    parser = argparse.ArgumentParser(
        description="Language player LAN media server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "examples:\n"
            "  python3 server.py 8000 medium_level\n"
            "  python3 server.py --port 8000 --media /path/to/courses\n"
            "  python3 server.py 8000\n"
            "\n"
            "note: do not use `python3 -m http.server` for this project.\n"
        ),
    )
    parser.add_argument(
        "port",
        nargs="?",
        type=int,
        default=8000,
        help="TCP port (default 8000)",
    )
    parser.add_argument(
        "media",
        nargs="?",
        default=None,
        help="media directory (default: ./medium_level if present, else script dir)",
    )
    parser.add_argument("-p", "--port-opt", dest="port_opt", type=int, default=None, help="same as positional port")
    parser.add_argument("-d", "--media", dest="media_opt", default=None, help="same as positional media dir")

    args = parser.parse_args()
    port = args.port_opt if args.port_opt is not None else args.port
    media_arg = args.media_opt or args.media

    if media_arg:
        media_root = os.path.abspath(media_arg)
    else:
        default_media = os.path.join(WEB_ROOT, "medium_level")
        media_root = default_media if os.path.isdir(default_media) else WEB_ROOT

    if not os.path.isdir(media_root):
        print(f"Media directory not found: {media_root}", file=sys.stderr)
        sys.exit(1)

    media_name = os.path.basename(media_root.rstrip(os.sep)) or "media"
    PlayerHandler.media_root = media_root
    PlayerHandler.media_name = media_name

    server = ThreadingHTTPServer(("0.0.0.0", port), PlayerHandler)
    ip = lan_ip()

    print("=" * 52)
    print(f"  Web root : {WEB_ROOT}")
    print(f"  Media    : {media_root}  ({media_name})")
    print(f"  Desktop  : http://127.0.0.1:{port}/index.html")
    print(f"  Phone    : http://{ip}:{port}/index.html")
    print("  共用同一目录；手机与电脑打开同一 URL 即可")
    print("  Ctrl+C 停止")
    print("=" * 52)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        server.server_close()


if __name__ == "__main__":
    main()
