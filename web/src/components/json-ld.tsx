/**
 * Structured data for search engines (schema.org JSON-LD).
 * "<" is escaped so user-written text (e.g. a listing title) can never close
 * the script tag and inject HTML.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
