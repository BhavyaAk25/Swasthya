"""Whiten off-white patches that touch the white plate (woman hero assets only).

A pixel is "plate" if it is light (min channel >= 205) and nearly neutral/warm-linen
(max-min <= 28) and connected to the image border through such pixels. Plate pixels become
pure white; a 2px ring around them is divided by the local patch tint so antialiased edges
lose the linen cast too. Eyes, skin, hair and the sage tee never qualify.
"""
import subprocess, sys
import numpy as np
from PIL import Image
from scipy import ndimage

def clean(rgb):
    a = rgb.astype(np.float32)
    mn, mx = a.min(2), a.max(2)
    cand = (mn >= 205) & (mx - mn <= 28)
    lab, n = ndimage.label(cand)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    plate = np.isin(lab, border[border > 0])
    off = plate & (mn < 252)                         # the tinted part of the plate
    out = a.copy()
    if off.any():
        tint = np.median(a[off], axis=0)             # e.g. linen ~ (246,239,231)
        ring = ndimage.binary_dilation(off, iterations=2) & ~plate
        out[ring] = np.clip(a[ring] * (255.0 / tint), 0, 255)
    out[plate] = 255
    return out.round().astype(np.uint8), int(off.sum())

if __name__ == "__main__":
    mode, src, dst = sys.argv[1], sys.argv[2], sys.argv[3]
    if mode == "image":
        img = Image.open(src).convert("RGB")
        out, n = clean(np.asarray(img))
        Image.fromarray(out).save(dst, "WEBP", quality=92, method=6)
        print(src, "fixed px", n)
    else:
        ff = sys.argv[4]
        info = subprocess.run([ff, "-i", src], capture_output=True, text=True).stderr
        import re
        w, h = map(int, re.search(r", (\d{2,4})x(\d{2,4})", info).groups())
        raw = subprocess.run([ff, "-v", "error", "-i", src, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
        frames = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)
        total = 0
        enc = subprocess.Popen([ff, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", "60", "-i", "-",
                                "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-profile:v", "high",
                                "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
                                "-movflags", "+faststart", "-an", dst], stdin=subprocess.PIPE)
        for f in frames:
            out, n = clean(f)
            total += n
            enc.stdin.write(out.tobytes())
        enc.stdin.close(); enc.wait()
        print(src, len(frames), "frames, fixed px total", total)
