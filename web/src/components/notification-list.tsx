"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/notifications";

type Item = { id: number; text: string; href: string | null; read: boolean; date: string };

export function NotificationList({ items, text }: { items: Item[]; text: { markAllRead: string; empty: string } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const hasUnread = items.some((i) => !i.read);

  if (items.length === 0) {
    return <p className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">{text.empty}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {hasUnread && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await markAllNotificationsReadAction();
              router.refresh();
            })
          }
          className="w-fit rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold hover:bg-brand-soft disabled:opacity-60"
        >
          {text.markAllRead}
        </button>
      )}
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const body = (
            <>
              <span className="block" dir="auto">
                {item.text}
              </span>
              <span className="text-xs text-muted">{item.date}</span>
            </>
          );
          const cls = `block rounded-xl border p-3 ${item.read ? "border-border bg-surface" : "border-brand/40 bg-brand-soft font-semibold"}`;
          return (
            <li key={item.id}>
              {item.href ? (
                <Link href={item.href} className={`${cls} hover:border-brand`} onClick={() => !item.read && markNotificationReadAction(item.id)}>
                  {body}
                </Link>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
