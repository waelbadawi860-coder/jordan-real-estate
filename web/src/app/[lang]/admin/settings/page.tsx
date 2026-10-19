import { notFound } from "next/navigation";
import { SettingField } from "@/components/admin/admin-controls";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireAdminPage } from "@/lib/admin";
import { booleanSettings, editableSettings, numberSettings } from "@/lib/admin-settings";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AdminSettingsPage({ params }: PageProps<"/[lang]/admin/settings">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireAdminPage(lang, "/admin/settings");
  const dict = await getDictionary(lang);
  const s = dict.admin.settings;

  // Read fresh (not cached) so the admin always sees current values.
  const supabase = await createClient();
  const { data } = await supabase.from("site_settings").select("key, value").in("key", editableSettings);
  const values = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <p className="mb-2 text-sm text-muted">{s.hint}</p>
      {editableSettings.map((key) => {
        const raw = values[key];
        const value = raw === null || raw === undefined ? "" : String(raw);
        return (
          <SettingField
            key={key}
            settingKey={key}
            label={s.labels[key]}
            value={value}
            kind={booleanSettings.includes(key) ? "boolean" : numberSettings.includes(key) ? "number" : "text"}
            a={dict.admin}
          />
        );
      })}
    </section>
  );
}
