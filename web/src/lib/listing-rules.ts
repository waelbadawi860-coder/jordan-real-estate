/** Whether the seller may renew now: expired, or within the renewal window before expiry. */
export function canRenewListing(status: string, expiresAt: string | null, windowDays: number, now: number = Date.now()): boolean {
  if (status === "expired") return true;
  if (status !== "published" || !expiresAt) return false;
  return new Date(expiresAt).getTime() - now <= windowDays * 86_400_000;
}
