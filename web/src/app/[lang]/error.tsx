"use client";

import { useEffect } from "react";

// Shown if a page fails unexpectedly. Text is bilingual because this runs in
// the browser without access to the translation files.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-extrabold">
        <span lang="ar">حدث خطأ غير متوقع</span>
        <span className="mx-2 text-muted">/</span>
        <span lang="en">Something went wrong</span>
      </h1>
      <button
        type="button"
        onClick={reset}
        className="h-12 rounded-lg bg-brand px-8 font-bold text-white hover:bg-brand-strong"
      >
        <span lang="ar">إعادة المحاولة</span> · <span lang="en">Try again</span>
      </button>
    </div>
  );
}
