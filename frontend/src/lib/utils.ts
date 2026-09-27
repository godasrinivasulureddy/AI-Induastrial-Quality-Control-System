import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function percent(value: number | undefined | null, digits = 1) {
  return `${(((value ?? 0) <= 1 ? value ?? 0 : (value ?? 0) / 100) * 100).toFixed(digits)}%`;
}

export function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function classForPrediction(label: string) {
  return label === "defective"
    ? "border-rose-400/40 bg-rose-500/10 text-rose-100"
    : "border-emerald-400/40 bg-emerald-500/10 text-emerald-100";
}
