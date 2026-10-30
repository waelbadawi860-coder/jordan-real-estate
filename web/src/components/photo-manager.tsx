"use client";

import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { addPhotoAction, deletePhotoAction, makeMainPhotoAction, reportPhotoUploadFailureAction } from "@/app/actions/listings";
import type { Dictionary } from "@/i18n/dictionaries";
import { ImageError, prepareImage } from "@/lib/images/prepare";
import { publicEnv } from "@/lib/env";
import { t } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

type Photo = { id: string; url: string | null };

/** Uploads straight to private storage with a progress bar (supabase-js has no progress events). */
function uploadWithProgress(path: string, blob: Blob, token: string, onProgress: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/listing-photos/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    xhr.setRequestHeader("Content-Type", blob.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(blob);
  });
}

export function PhotoManager({
  listingId,
  userId,
  photos,
  maxPhotos,
  maxDimension,
  text,
}: {
  listingId: number;
  userId: string;
  photos: Photo[];
  maxPhotos: number;
  maxDimension: number;
  text: Dictionary["photos"];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const remaining = maxPhotos - photos.length;

  async function onFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const files = Array.from(fileList).slice(0, Math.max(0, remaining));
    const problems: string[] = [];
    if (fileList.length > remaining) problems.push(t(text.limit, { max: maxPhotos }));
    setBusy(true);
    setErrors([]);

    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setBusy(false);
      setErrors([t(text.uploadFailed, { name: "" })]);
      return;
    }

    for (const [index, file] of files.entries()) {
      const name = file.name || `#${index + 1}`;
      try {
        setProgress(null);
        const image = await prepareImage(file, maxDimension);
        const mainPath = `${userId}/${listingId}/${crypto.randomUUID()}.${image.extension}`;
        const thumbExt = image.thumb.type === "image/webp" ? "webp" : "jpg";
        const thumbPath = `${userId}/${listingId}/${crypto.randomUUID()}.${thumbExt}`;
        const base = index / files.length;
        await uploadWithProgress(mainPath, image.main, token, (f) => setProgress((base + f * 0.85 / files.length) * 100));
        await uploadWithProgress(thumbPath, image.thumb, token, (f) =>
          setProgress((base + (0.85 + f * 0.15) / files.length) * 100),
        );
        const result = await addPhotoAction({ listingId, storagePath: mainPath, thumbPath, width: image.width, height: image.height });
        // Saving failures are recorded on the server; nothing to report here.
        if (!result.ok) problems.push(t(text.uploadFailed, { name }));
      } catch (error) {
        if (error instanceof ImageError) {
          problems.push(t(error.reason === "tooLarge" ? text.tooLarge : text.notImage, { name }));
        } else {
          problems.push(t(text.uploadFailed, { name }));
          // Upload failures happen in the browser: tell the server so admins see them.
          void reportPhotoUploadFailureAction(error instanceof Error ? error.message.slice(0, 80) : "unknown").catch(() => undefined);
        }
      }
    }

    setBusy(false);
    setProgress(null);
    setErrors(problems);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  function run(action: () => Promise<{ ok: boolean }>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t(text.hint, { max: maxPhotos })}</p>

      {photos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-muted">{text.none}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy={pending}>
          {photos.map((photo, index) => (
            <li key={photo.id} className="overflow-hidden rounded-xl border border-border bg-surface">
              <div className="relative aspect-[4/3] bg-brand-soft">
                {photo.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.url} alt="" className="size-full object-cover" loading="lazy" />
                )}
                {index === 0 && (
                  <span className="absolute start-2 top-2 rounded-md bg-brand px-2 py-0.5 text-xs font-bold text-white">
                    {text.main}
                  </span>
                )}
              </div>
              <div className="flex justify-between gap-1 p-1.5">
                {index > 0 ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => makeMainPhotoAction(photo.id))}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-soft"
                  >
                    <Star className="size-3.5" aria-hidden />
                    {text.makeMain}
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => window.confirm(text.deleteConfirm) && run(() => deletePhotoAction(photo.id))}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/5"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  {text.remove}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {errors.length > 0 && (
        <ul role="alert" className="list-inside list-disc rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm font-semibold text-danger">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {busy && (
        <div role="status" className="flex flex-col gap-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {progress === null ? text.processing : t(text.uploading, { percent: Math.round(progress) })}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div className="h-full bg-brand transition-all" style={{ width: `${progress ?? 5}%` }} />
          </div>
        </div>
      )}

      {remaining > 0 && (
        <label
          className={`flex h-12 w-fit cursor-pointer items-center gap-2 rounded-lg border-2 border-brand px-5 font-bold text-brand hover:bg-brand-soft ${
            busy ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <ImagePlus className="size-5" aria-hidden />
          {text.add}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            disabled={busy}
            className="sr-only"
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
      )}
    </div>
  );
}
