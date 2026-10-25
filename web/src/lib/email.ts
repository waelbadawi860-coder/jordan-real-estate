import "server-only";

// Sends e-mail through Resend's HTTP API. Needs RESEND_API_KEY and
// EMAIL_FROM (e.g. "عقار <no-reply@yourdomain.com>") — until the domain and
// Resend are set up, sending is skipped and callers are told so.

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(message: {
  to: string;
  subject: string;
  html: string;
  /** One-click unsubscribe address (RFC 8058), shown by mail apps as "Unsubscribe". */
  unsubscribeUrl?: string;
}): Promise<boolean> {
  if (!emailConfigured()) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      headers: message.unsubscribeUrl
        ? { "List-Unsubscribe": `<${message.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
        : undefined,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) console.error("email: send failed", { status: res.status });
  return res.ok;
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
