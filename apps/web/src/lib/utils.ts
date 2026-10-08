import { clsx, type ClassValue } from "clsx";

export function cn(...values: ClassValue[]) {
  return clsx(values);
}

export function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Local calendar date (not UTC) as YYYY-MM-DD. */
export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function lastNDays(n: number, from = new Date()) {
  return Array.from({ length: n }, (_, i) => dateKey(addDays(from, i - (n - 1))));
}

export function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")} ${period}` : `${hour} ${period}`;
}

export function formatClock(iso: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function weekdayShort(key: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(new Date(`${key}T12:00:00`));
}

export function longDate(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(date);
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Rest well";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Next occurrence of a local HH:MM time. */
export function nextAt(hhmm: string, now = new Date()) {
  const [h, m] = hhmm.split(":").map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target;
}

export function countdown(target: Date, now = new Date()) {
  const mins = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return r ? `in ${h}h ${r}m` : `in ${h}h`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Downscale an image data URL to a JPEG no larger than `max` px on its long edge. */
export async function shrinkImage(dataUrl: string, max = 1024, quality = 0.82): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("read")));
    reader.onerror = () => reject(reader.error ?? new Error("read"));
    reader.readAsDataURL(file);
  });
}
