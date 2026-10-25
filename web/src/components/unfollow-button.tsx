"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { unfollowAction } from "@/app/actions/follow";

export function UnfollowButton({ id, label }: { id: number; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await unfollowAction(id);
          router.refresh();
        })
      }
      className="rounded-lg border border-danger/40 px-3 py-2 text-sm font-semibold text-danger hover:bg-danger/5 disabled:opacity-60"
    >
      {label}
    </button>
  );
}
