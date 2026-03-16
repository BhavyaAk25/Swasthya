import { clsx } from "clsx";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

export function formatTimeLabel(value: string) {
  const [hourString, minuteString] = value.split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
}

export function minutesUntil(dateString: string) {
  const target = new Date(dateString).getTime();
  const now = Date.now();
  return Math.max(0, Math.round((target - now) / 60000));
}

export function formatCountdown(minutes: number) {
  if (minutes <= 0) {
    return "Live now";
  }

  if (minutes < 60) {
    return `In ${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `In ${hours}h`;
  }

  return `In ${hours}h ${remainingMinutes}m`;
}

export function formatDateLabel(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}
