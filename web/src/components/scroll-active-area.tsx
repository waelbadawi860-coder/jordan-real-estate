"use client";

import { useEffect } from "react";

/** Scrolls the chosen area tag into view, so it isn't hidden off the edge of the one-line row. */
export function ScrollActiveArea() {
  useEffect(() => {
    const active = document.querySelector<HTMLElement>(".area-scroll [aria-current='page']");
    // Works for right-to-left rows too; "nearest" keeps the page itself from jumping.
    active?.scrollIntoView({ block: "nearest", inline: "center", behavior: "instant" });
  }, []);
  return null;
}
