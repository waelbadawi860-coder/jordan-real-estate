"use client";

import { useSyncExternalStore } from "react";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/lib/format";

// "5 minutes ago" depends on the visitor's clock, so the server (and cached
// pages) show the plain date and the browser swaps in the relative time.
const MINUTE = 60_000;

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, MINUTE);
  return () => clearInterval(timer);
}
const currentMinute = () => Math.floor(Date.now() / MINUTE);
const noClock = () => null;

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60],
  ["month", 30 * 24 * 60],
  ["week", 7 * 24 * 60],
  ["day", 24 * 60],
  ["hour", 60],
  ["minute", 1],
];

export function relativeTime(iso: string, nowMinute: number, locale: Locale): string {
  const minutes = Math.max(0, nowMinute - Math.floor(new Date(iso).getTime() / MINUTE));
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar-JO-u-nu-latn" : "en", { numeric: "auto" });
  for (const [unit, size] of units) {
    if (minutes >= size) return rtf.format(-Math.floor(minutes / size), unit);
  }
  return rtf.format(0, "minute");
}

export function TimeAgo({ iso, locale }: { iso: string; locale: Locale }) {
  const now = useSyncExternalStore(subscribe, currentMinute, noClock);
  return (
    <time dateTime={iso} title={formatDate(iso, locale)}>
      {now === null ? formatDate(iso, locale) : relativeTime(iso, now, locale)}
    </time>
  );
}
