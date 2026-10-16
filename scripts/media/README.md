# Media repair tools

Offline helpers for the character clips in `apps/web/public/images/characters/`. They need Python 3 with
`numpy pillow scipy imageio-ffmpeg` (a venv is fine); pass the ffmpeg path from
`python -c "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())"`.

- `clean_plate.py image|video SRC DST [FFMPEG]`: whitens off-white patches that touch a white plate
  (used on the woman hero assets, which had a linen block behind her neck). Only for white-plate
  hero media; never run it on the man (his ivory tee would qualify).
- `retime.py FFMPEG SRC DST SIGMA`: evens out motion speed in a looping clip without changing its
  length (short freezes and jumps become a glide; long holds stay). Sigma 5 was used for pushup,
  pike, deadbug, catcow, row, twist, fold and lunge.

After replacing a file, bump its `?v=` key in `components/characters/assets.ts` so browsers refetch it.
