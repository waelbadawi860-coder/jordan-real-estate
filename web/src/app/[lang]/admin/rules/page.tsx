import { notFound } from "next/navigation";
import { RetireRuleButton, RuleForm } from "@/components/admin/commission-controls";
import { RuleSummary } from "@/components/commission/rule-summary";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireAdminPage } from "@/lib/admin";
import { toRule } from "@/lib/data/commission";
import { formatDate, t } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AdminRulesPage({ params }: PageProps<"/[lang]/admin/rules">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireAdminPage(lang, "/admin/rules");
  const dict = await getDictionary(lang);
  const r = dict.admin.rules;

  const supabase = await createClient();
  const { data: rules } = await supabase
    .from("commission_rules")
    .select("*, agreement_versions(version_label)")
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });
  const box = "rounded-2xl border border-border bg-surface p-4";

  return (
    <div className="flex flex-col gap-4">
      {!rules?.length ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-muted">{r.none}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rules.map((rule) => (
            <li key={rule.id} className={`${box} ${rule.is_active ? "" : "opacity-60"}`}>
              <p className="mb-1 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-bold">{rule.deal_type === "sale" ? dict.search.sale : dict.search.rent}</span>
                <span className={`rounded px-2 text-xs font-bold ${rule.is_active ? "bg-brand text-white" : "bg-border"}`}>
                  {rule.is_active ? r.active : r.retired}
                </span>
                <span className="text-xs text-muted">
                  #{rule.id} · {formatDate(rule.created_at, lang)} ·{" "}
                  {t(r.agreementVersion, { label: (rule.agreement_versions as { version_label: string } | null)?.version_label ?? "" })}
                </span>
              </p>
              <RuleSummary rule={toRule(rule)} dict={dict} locale={lang} />
              {rule.is_active && (
                <div className="mt-2">
                  <RetireRuleButton ruleId={rule.id} a={dict.admin} c={dict.commission} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <section className={box} aria-labelledby="new-rule">
        <h2 id="new-rule" className="mb-3 text-lg font-extrabold">
          {r.create}
        </h2>
        <RuleForm a={dict.admin} c={dict.commission} dealLabels={{ sale: dict.search.sale, rent: dict.search.rent }} />
      </section>
    </div>
  );
}
