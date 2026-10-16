"""Even out motion speed in a looping clip without changing its length.

Visual distance between frames (mean abs diff, cyclic incl. the loop seam) is smoothed with a
cyclic Gaussian; output frame k shows the source moment whose cumulative distance matches the
smoothed cumulative distance, cross-fading the two nearest source frames. Short freezes and
jumps become an even glide; long deliberate holds stay held.
"""
import re, subprocess, sys
import numpy as np

FF, src, dst, sigma = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
info = subprocess.run([FF, "-i", src], capture_output=True, text=True).stderr
w, h = map(int, re.search(r", (\d{3,4})x(\d{3,4})", info).groups())
raw = subprocess.run([FF, "-v", "error", "-i", src, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
F = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)
N = len(F)
g = F[:, ::4, ::4].astype(np.float32).mean(3)
d = np.array([np.abs(g[(i + 1) % N] - g[i]).mean() for i in range(N)])  # d[N-1] = seam
d = np.maximum(d, 0.02 * np.median(d) + 1e-4)
D = np.concatenate([[0], np.cumsum(d)])          # D[i] = distance at source frame i (D[N] = loop)
r = int(4 * sigma)
k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2); k /= k.sum()
s = np.convolve(np.concatenate([d[-r:], d, d[:r]]), k, mode="valid")
s *= D[-1] / s.sum()
T = np.concatenate([[0], np.cumsum(s)])[:N]       # target distance for each output frame
tau = np.interp(T, D, np.arange(N + 1))            # source time (frames) for each output frame

enc = subprocess.Popen([FF, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", "60", "-i", "-",
                        "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p", "-profile:v", "high",
                        "-g", "60", "-movflags", "+faststart", "-an", dst], stdin=subprocess.PIPE)
for t in tau:
    i = int(np.floor(t)) % N
    j = (i + 1) % N
    a = t - np.floor(t)
    frame = F[i] if a < 0.02 else F[j] if a > 0.98 else (F[i] * (1 - a) + F[j] * a).round().astype(np.uint8)
    enc.stdin.write(np.ascontiguousarray(frame, dtype=np.uint8).tobytes())
enc.stdin.close(); enc.wait()
print(f"{src}: {N} frames, max source step {np.diff(tau).max():.2f}, min {np.diff(tau).min():.2f}")
