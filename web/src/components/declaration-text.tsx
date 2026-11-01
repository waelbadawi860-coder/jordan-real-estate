import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

// The advertiser's declaration in short, with links to the policies. The full
// text (what the seller legally accepts, kept with its version) stays one
// click away instead of filling the screen.
export function DeclarationText({ locale, d }: { locale: Locale; d: Dictionary["declaration"] }) {
  const link = "font-semibold text-brand underline";
  return (
    <div className="flex flex-col gap-1 text-sm leading-relaxed">
      <p>
        {d.short}{" "}
        <Link href={localePath(locale, "/posting-policy")} target="_blank" className={link}>
          {d.postingLink}
        </Link>
        {" "}
        {d.and}
        <Link href={localePath(locale, "/terms")} target="_blank" className={link}>
          {d.termsLink}
        </Link>
        .
      </p>
      <details>
        <summary className="w-fit cursor-pointer text-xs font-semibold text-muted">{d.fullText}</summary>
        <p className="mt-1 text-xs">{d.text}</p>
      </details>
    </div>
  );
}
