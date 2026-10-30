import type { Instrumentation } from "next";

// Server error reporting. Errors are written to the hosting logs (Vercel →
// Project → Logs) as one JSON line each, WITHOUT personal data: no cookies,
// headers, query strings or form contents. A dedicated service (e.g. Sentry)
// can be added later by sending the same object to it here.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const error = err as { message?: string; digest?: string; name?: string };
  console.error(
    JSON.stringify({
      level: "error",
      at: new Date().toISOString(),
      name: error?.name,
      // Messages from our code never contain personal data; truncate anyway.
      message: String(error?.message ?? err).slice(0, 300),
      digest: error?.digest,
      method: request.method,
      path: request.path.split("?")[0],
      route: context.routePath,
      type: context.routeType,
    }),
  );
  // Also counted on the admin dashboard (server runtime only; never throws).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { recordSystemEvent } = await import("@/lib/monitoring");
    await recordSystemEvent("server_error", `${request.method} ${context.routePath}`, `${error?.name ?? "Error"}: ${String(error?.message ?? err).slice(0, 200)}`);
  }
};
