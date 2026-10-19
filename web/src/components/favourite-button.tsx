"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleFavouriteAction } from "@/app/actions/listings";

export function FavouriteButton({
  listingId,
  initialSaved,
  loginHref,
  text,
}: {
  listingId: number;
  initialSaved: boolean;
  loginHref: string;
  text: { add: string; remove: string };
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await toggleFavouriteAction(listingId);
      if ("saved" in result) setSaved(result.saved);
      else if (result.error === "login") router.push(loginHref);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold hover:bg-brand-soft disabled:opacity-60"
    >
      <Heart className={`size-4 ${saved ? "fill-danger text-danger" : ""}`} aria-hidden />
      {saved ? text.remove : text.add}
    </button>
  );
}
