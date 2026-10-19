import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RuleSummary } from "@/components/commission/rule-summary";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCommissionTerms } from "@/lib/data/commission";
import { getReferenceData } from "@/lib/data/public";

export async function generateMetadata({ params }: PageProps<"/[lang]/commission-policy">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).footer.commission };
}

// Public explanation of commissions. While the agreement is a draft the page
// says so clearly, so unreviewed terms are never presented as approved.
export default async function CommissionPolicyPage({ params }: PageProps<"/[lang]/commission-policy">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const [dict, ref, terms] = await Promise.all([getDictionary(lang), getReferenceData(), getCommissionTerms()]);
  const c = dict.commission;
  const enabled = ref.settings.commission_enabled === true;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
      <h1 className="text-2xl font-extrabold">{dict.footer.commission}</h1>
      <p className="text-muted">{c.policyIntro}</p>

      {!enabled ? (
        <p className="rounded-xl border border-border bg-surface p-4 font-semibold">{c.policyDisabled}</p>
      ) : (
        <>
          <section className="rounded-2xl border border-border bg-surface p-4" aria-labelledby="rules">
            <h2 id="rules" className="mb-2 text-lg font-extrabold">
              {c.policyRules}
            </h2>
            {terms.rules.length === 0 ? (
              <p className="text-muted">{c.policyNoRules}</p>
            ) : (
              terms.rules.map((rule) => (
                <div key={rule.id} className="mb-3">
                  <h3 className="font-bold">{rule.dealType === "sale" ? dict.search.sale : dict.search.rent}</h3>
                  <RuleSummary rule={rule} dict={dict} locale={lang} />
                </div>
              ))
            )}
          </section>
          {terms.agreement && (
            <section className="rounded-2xl border border-border bg-surface p-4" aria-labelledby="agreement">
              <h2 id="agreement" className="mb-2 text-lg font-extrabold">
                {c.policyAgreement}: {terms.agreement.title[lang]}
              </h2>
              {terms.agreement.isDraft && <p className="mb-2 rounded-lg bg-accent-soft p-2 text-sm font-bold text-accent">{c.draftBanner}</p>}
              <p className="whitespace-pre-line text-sm leading-relaxed">{terms.agreement.body[lang]}</p>
            </section>
          )}
        </>
      )}
      <p className="text-xs text-muted">{c.policyDisclaimer}</p>
    </div>
  );
}
