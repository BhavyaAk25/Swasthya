"""Turn a clip's soft beige plate into pure white without touching the people.

A smooth plate surface (2D cubic per channel) is fitted to the median frame using only
light, low-chroma pixels, rejecting anything darker than the fit (the man's ivory tee,
shadows, mats). Every frame and the poster are divided by that surface, so the plate becomes
~255 and everything else keeps its exact contrast against the plate. Painted onto a page with
canvas multiply, the plate then disappears into the page colour.
"""
import re, subprocess, sys
import numpy as np
from PIL import Image

def basis(h, w, step=1):
    ys, xs = np.mgrid[0:h:step, 0:w:step].astype(np.float32)
    x = xs / w * 2 - 1
    y = ys / h * 2 - 1
    terms = [np.ones_like(x), x, y, x * x, x * y, y * y, x ** 3, x * x * y, x * y * y, y ** 3]
    return np.stack(terms, -1)

def fit_plate(median):
    h, w, _ = median.shape
    step = 4
    B = basis(h, w, step)
    m = median[::step, ::step]
    lum = m.mean(-1)
    ok = (m.min(-1) >= 200) & (m.max(-1) - m.min(-1) <= 40)
    coef = None
    for _ in range(6):
        X = B[ok]
        coef = np.linalg.lstsq(X, m[ok], rcond=None)[0]
        fit = B @ coef
        r = lum - fit.mean(-1)
        ok = ok & (r > -3.0) & (r < 6.0)
    full = basis(h, w) @ coef
    return np.clip(full, 120, 255), int(ok.sum())

def load_frames(ff, src):
    info = subprocess.run([ff, "-i", src], capture_output=True, text=True).stderr
    w, h = map(int, re.search(r", (\d{3,4})x(\d{3,4})", info).groups())
    raw = subprocess.run([ff, "-v", "error", "-i", src, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3), w, h

EDGE = None

def edge_weight(h, w, band=48):
    ys, xs = np.mgrid[0:h, 0:w]
    d = np.minimum(np.minimum(xs, w - 1 - xs), np.minimum(ys, h - 1 - ys)).astype(np.float32)
    return np.clip(1 - d / band, 0, 1)[..., None]

def normalize(frame, plate):
    global EDGE
    out = np.clip(frame.astype(np.float32) * (255.0 / plate), 0, 255)
    if EDGE is None or EDGE.shape[:2] != out.shape[:2]:
        EDGE = edge_weight(*out.shape[:2])
    # Near the frame edge, ease plate-like pixels (light, neutral) to pure white; people and mats are untouched.
    plate_like = ((out.min(-1) >= 228) & (out.max(-1) - out.min(-1) <= 14))[..., None]
    out = np.where(plate_like, out + (255 - out) * EDGE, out)
    return out.round().astype(np.uint8)

if __name__ == "__main__":
    ff, src_mp4, src_webp, out_mp4, out_webp = sys.argv[1:6]
    frames, w, h = load_frames(ff, src_mp4)
    idx = np.linspace(0, len(frames) - 1, min(len(frames), 48)).astype(int)
    median = np.median(frames[idx].astype(np.float32), axis=0)
    plate, kept = fit_plate(median)
    enc = subprocess.Popen([ff, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", "60", "-i", "-",
                            "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p", "-profile:v", "high",
                            "-g", "60", "-movflags", "+faststart", "-an", out_mp4], stdin=subprocess.PIPE)
    for f in frames:
        enc.stdin.write(normalize(f, plate).tobytes())
    enc.stdin.close(); enc.wait()
    poster = np.asarray(Image.open(src_webp).convert("RGB"))
    Image.fromarray(normalize(poster, plate)).save(out_webp, "WEBP", quality=90, method=6)
    nb = normalize(median, plate)
    corners = [nb[8, 8], nb[8, w - 9], nb[h - 9, 8], nb[h - 9, w - 9], nb[h // 2, 8]]
    print(f"{src_mp4}: plate px kept {kept}, plate range {plate.min():.0f}-{plate.max():.0f}, normalized corners {[tuple(int(v) for v in c) for c in corners]}")
