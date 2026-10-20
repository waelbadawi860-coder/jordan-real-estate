import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NotificationList } from "@/components/notification-list";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUser } from "@/lib/auth";
import { getMyNotifications } from "@/lib/data/notifications";
import { formatDate } from "@/lib/format";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[lang]/my/notifications">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).notifications.title, robots: { index: false } };
}

export default async function NotificationsPage({ params }: PageProps<"/[lang]/my/notifications">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireUser(lang, "/my/notifications");
  const dict = await getDictionary(lang);
  const items = await getMyNotifications(user.id, dict, lang);

  return (
    <section aria-labelledby="notifications-heading">
      <h1 id="notifications-heading" className="mb-4 text-2xl font-extrabold">
        {dict.notifications.title}
      </h1>
      <NotificationList
        items={items.map((i) => ({ id: i.id, text: i.text, href: i.href, read: i.read, date: formatDate(i.createdAt, lang) }))}
        text={{ markAllRead: dict.notifications.markAllRead, empty: dict.notifications.empty }}
      />
    </section>
  );
}
