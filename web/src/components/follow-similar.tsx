"use client";

import { Bell, BellRing } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { followSimilarAction, unfollowAction } from "@/app/actions/follow";

type Text = { follow: string; following: string; unfollow: string; limit: string; error: string; hint: string };

/** Button to follow new listings like this one (deal, type, governorate, area). */
export function FollowSimilar({
  listingId,
  initialId,
  signedIn,
  loginHref,
  text,
}: {
  listingId: number;
  /** The existing follow's id, or null when not following yet. */
  initialId: number | null;
  signedIn: boolean;
  loginHref: string;
  text: Text;
}) {
  const [followId, setFollowId] = useState<number | null>(initialId);
  const [following, setFollowing] = useState(initialId !== null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const button = "flex h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold sm:w-auto";

  if (!signedIn) {
    return (
      <Link href={loginHref} className={`${button} border-brand text-brand hover:bg-brand-soft`}>
        <Bell className="size-4" aria-hidden />
        {text.follow}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {following ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              if (followId !== null) await unfollowAction(followId);
              setFollowing(false);
              setFollowId(null);
              setMessage(null);
            })
          }
          className={`${button} border-brand bg-brand-soft text-brand disabled:opacity-60`}
          title={text.unfollow}
        >
          <BellRing className="size-4" aria-hidden />
          {text.following}
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await followSimilarAction(listingId);
              if (result.ok) {
                setFollowing(true);
                setFollowId(result.id);
                setMessage(text.hint);
              } else {
                setMessage(result.error === "limit" ? text.limit : text.error);
              }
            })
          }
          className={`${button} border-brand text-brand hover:bg-brand-soft disabled:opacity-60`}
        >
          <Bell className="size-4" aria-hidden />
          {text.follow}
        </button>
      )}
      {message && <p className="text-xs text-muted">{message}</p>}
    </div>
  );
}
