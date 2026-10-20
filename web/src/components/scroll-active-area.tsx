"use client";

import { useEffect } from "react";

/** Scrolls the chosen type and area tags into view, so they aren't hidden off the edge of their one-line rows. */
export function ScrollActiveArea() {
  useEffect(() => {
    // Works for right-to-left rows too; "nearest" keeps the page itself from jumping.
    for (const active of document.querySelectorAll<HTMLElement>(".type-scroll [aria-current='page'], .area-scroll [aria-current='page']")) {
      active.scrollIntoView({ block: "nearest", inline: "center", behavior: "instant" });
    }
  }, []);
  return null;
}
