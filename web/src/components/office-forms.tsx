"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { saveOfficeAction, submitVerificationAction, type OfficeFormState } from "@/app/actions/offices";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { displayPhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { FormMessage, inputClass, keepValuesOnSubmit, SubmitButton, TextField } from "./form-controls";

type OfficeText = Dictionary["office"];

export function OfficeForm({
  locale,
  text,
  form,
  cities,
  office,
}: {
  locale: Locale;
  text: OfficeText;
  form: Dictionary["form"];
  cities: { id: number; name: { ar: string; en: string } }[];
  office: { name: string; phone: string | null; cityId: number | null; about: string | null } | null;
}) {
  const [state, action, pending] = useActionState(saveOfficeAction, {} as OfficeFormState);
  const [, startTransition] = useTransition();
  const fe = state.fieldErrors ?? {};
  const errors = text.errors as Record<string, string>;

  return (
    <form onSubmit={keepValuesOnSubmit(action, startTransition)} className="flex flex-col gap-4" noValidate>
      {state.success && <FormMessage kind="success">{text.saved}</FormMessage>}
      {state.error && <FormMessage kind="error">{errors[state.error] ?? errors.generic}</FormMessage>}
      <TextField id="name" name="name" defaultValue={office?.name ?? ""} maxLength={80} required label={text.name} hint={text.nameHint} error={fe.name && errors[fe.name]} />
      <TextField
        id="phone"
        name="phone"
        type="tel"
        inputMode="tel"
        dir="ltr"
        defaultValue={office?.phone ? displayPhone(office.phone).replace(/\s/g, "") : ""}
        placeholder="0791234567"
        label={text.phone}
        error={fe.phone && errors[fe.phone]}
      />
      <div>
        <label htmlFor="cityId" className="mb-1 block text-sm font-semibold">
          {text.city}
        </label>
        <select id="cityId" name="cityId" defaultValue={office?.cityId ? String(office.cityId) : ""} className={inputClass}>
          <option value="">{form.choose}</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name[locale]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="about" className="mb-1 block text-sm font-semibold">
          {text.about}
        </label>
        <textarea id="about" name="about" rows={4} maxLength={1000} defaultValue={office?.about ?? ""} dir="auto" className={`${inputClass} h-auto py-2`} />
      </div>
      <div className="sm:w-60">
        <SubmitButton pendingText={form.saving} pending={pending}>
          {office ? text.save : text.create}
        </SubmitButton>
      </div>
    </form>
  );
}

const DOC_TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_DOC_BYTES = 10 * 1024 * 1024;

/** Uploads the documents straight to private storage, then asks the server to open the request. */
export function VerificationForm({ userId, text }: { userId: string; text: OfficeText }) {
  const router = useRouter();
  const docs = [text.docCommercialReg, text.docLicense, text.docId];
  const [files, setFiles] = useState<(File | null)[]>(docs.map(() => null));
  const [regNo, setRegNo] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errors = text.errors as Record<string, string>;

  async function submit() {
    setError(null);
    if (files.some((f) => !f)) return setError(errors.documentsRequired);
    for (const f of files) {
      if (!DOC_TYPES[f!.type]) return setError(errors.documentType);
      if (f!.size > MAX_DOC_BYTES) return setError(errors.documentSize);
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const paths: string[] = [];
      for (const f of files) {
        const path = `${userId}/${crypto.randomUUID()}.${DOC_TYPES[f!.type]}`;
        const { error: upload } = await supabase.storage.from("office-documents").upload(path, f!, { contentType: f!.type, upsert: false });
        if (upload) throw upload;
        paths.push(path);
      }
      const result = await submitVerificationAction({ commercialRegNo: regNo, licenseNo, documents: paths });
      if (!result.ok) return setError(errors[result.error ?? "generic"] ?? errors.generic);
      router.refresh();
    } catch {
      setError(errors.uploadFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <FormMessage kind="error">{error}</FormMessage>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="regNo" label={text.commercialRegNo} value={regNo} onChange={(e) => setRegNo(e.target.value)} maxLength={50} dir="ltr" />
        <TextField id="licenseNo" label={text.licenseNo} value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} maxLength={50} dir="ltr" />
      </div>
      {docs.map((label, i) => (
        <div key={label}>
          <label htmlFor={`doc-${i}`} className="mb-1 block text-sm font-semibold">
            {label}
          </label>
          <input
            id={`doc-${i}`}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => setFiles((prev) => prev.map((f, j) => (j === i ? (e.target.files?.[0] ?? null) : f)))}
            className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-semibold"
          />
        </div>
      ))}
      <p className="text-xs text-muted">{text.docsHint}</p>
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="h-11 rounded-lg bg-brand px-5 font-bold text-white hover:bg-brand-strong disabled:opacity-60 sm:w-60"
      >
        {busy ? text.uploading : text.submitVerification}
      </button>
    </div>
  );
}
