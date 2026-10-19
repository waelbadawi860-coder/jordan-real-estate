"use client";

import { useActionState, useState, useTransition } from "react";
import { createListingAction, updateListingAction, type ListingFormState } from "@/app/actions/listings";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { City, Neighborhood, PropertyType } from "@/lib/data/public";
import { FormMessage, inputClass, keepValuesOnSubmit, SubmitButton } from "./form-controls";

export type ListingFormValues = {
  dealType: "sale" | "rent" | "";
  rentPeriod: "monthly" | "yearly" | "";
  propertyTypeId: string;
  cityId: string;
  neighborhoodId: string;
  title: string;
  description: string;
  price: string;
  areaSqm: string;
  bedrooms: string;
  bathrooms: string;
  floor: string;
  furnished: "yes" | "no" | "";
  posterType: "owner" | "agent";
  phone: string;
  allowCalls: boolean;
  allowWhatsapp: boolean;
};

type Props = {
  locale: Locale;
  dict: Pick<Dictionary, "form" | "search">;
  refData: { cities: City[]; neighborhoods: Neighborhood[]; propertyTypes: PropertyType[] };
  initial: ListingFormValues;
  listingId?: number;
  warning?: string;
};

const label = "mb-1 block text-sm font-semibold";
const section = "flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5";

export function ListingForm({ locale, dict, refData, initial, listingId, warning }: Props) {
  const f = dict.form;
  const action = listingId ? updateListingAction.bind(null, listingId) : createListingAction;
  const [state, formAction, pending] = useActionState(action, {} as ListingFormState);
  const [, startTransition] = useTransition();

  const [dealType, setDealType] = useState(initial.dealType);
  const [typeId, setTypeId] = useState(initial.propertyTypeId);
  const [cityId, setCityId] = useState(initial.cityId);

  const type = refData.propertyTypes.find((t) => String(t.id) === typeId);
  const hasBedrooms = type?.hasBedrooms ?? true;
  const hoods = refData.neighborhoods.filter((n) => String(n.cityId) === cityId);
  const fe = state.fieldErrors ?? {};
  const err = (key: string) => (fe[key] ? ((f.errors as Record<string, string>)[fe[key]] ?? f.errors.generic) : undefined);
  const aria = (key: string) => (fe[key] ? { "aria-invalid": true, "aria-describedby": `${key}-error` } : {});

  return (
    <form onSubmit={keepValuesOnSubmit(formAction, startTransition)} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="lang" value={locale} />
      {warning && <FormMessage kind="info">{warning}</FormMessage>}
      {state.error && <FormMessage kind="error">{(f.errors as Record<string, string>)[state.error] ?? f.errors.generic}</FormMessage>}
      {state.saved && <FormMessage kind="success">{f.saved}</FormMessage>}

      <section className={section} aria-labelledby="s-basics">
        <h2 id="s-basics" className="text-lg font-extrabold">
          {f.sectionBasics}
        </h2>

        <fieldset>
          <legend className={label}>{f.dealType}</legend>
          <div className="flex gap-2">
            {(["sale", "rent"] as const).map((value) => (
              <label key={value} className="flex-1 cursor-pointer">
                <input
                  type="radio"
                  name="dealType"
                  value={value}
                  checked={dealType === value}
                  onChange={() => setDealType(value)}
                  className="peer sr-only"
                />
                <span className="block rounded-lg border border-border py-2.5 text-center font-bold text-muted peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-accent">
                  {value === "sale" ? dict.search.sale : dict.search.rent}
                </span>
              </label>
            ))}
          </div>
          <ErrorText name="dealType" message={err("dealType")} />
        </fieldset>

        {dealType === "rent" && (
          <div>
            <label htmlFor="rentPeriod" className={label}>
              {f.rentPeriod}
            </label>
            <select id="rentPeriod" name="rentPeriod" defaultValue={initial.rentPeriod} className={inputClass} {...aria("rentPeriod")}>
              <option value="">{f.choose}</option>
              <option value="monthly">{f.monthly}</option>
              <option value="yearly">{f.yearly}</option>
            </select>
            <ErrorText name="rentPeriod" message={err("rentPeriod")} />
          </div>
        )}

        <div>
          <label htmlFor="propertyTypeId" className={label}>
            {f.propertyType}
          </label>
          <select
            id="propertyTypeId"
            name="propertyTypeId"
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            className={inputClass}
            {...aria("propertyTypeId")}
          >
            <option value="">{f.choose}</option>
            {refData.propertyTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name[locale]}
              </option>
            ))}
          </select>
          <ErrorText name="propertyTypeId" message={err("propertyTypeId")} />
        </div>

        <div>
          <label htmlFor="title" className={label}>
            {f.title}
          </label>
          <input
            id="title"
            name="title"
            defaultValue={initial.title}
            maxLength={120}
            placeholder={f.titleHint}
            dir="auto"
            className={inputClass}
            {...aria("title")}
          />
          <ErrorText name="title" message={err("title")} />
        </div>

        <div>
          <label htmlFor="price" className={label}>
            {f.price}
          </label>
          <input
            id="price"
            name="price"
            inputMode="decimal"
            dir="ltr"
            defaultValue={initial.price}
            className={inputClass}
            aria-describedby={dealType === "rent" ? "price-hint" : undefined}
            {...aria("price")}
          />
          {dealType === "rent" && (
            <p id="price-hint" className="mt-1 text-xs text-muted">
              {f.priceRentHint}
            </p>
          )}
          <ErrorText name="price" message={err("price")} />
        </div>
      </section>

      <section className={section} aria-labelledby="s-location">
        <h2 id="s-location" className="text-lg font-extrabold">
          {f.sectionLocation}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cityId" className={label}>
              {f.city}
            </label>
            <select
              id="cityId"
              name="cityId"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className={inputClass}
              {...aria("cityId")}
            >
              <option value="">{f.choose}</option>
              {refData.cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name[locale]}
                </option>
              ))}
            </select>
            <ErrorText name="cityId" message={err("cityId")} />
          </div>
          <div>
            <label htmlFor="neighborhoodId" className={label}>
              {f.neighborhood} <span className="font-normal text-muted">({f.optional})</span>
            </label>
            <select
              key={cityId}
              id="neighborhoodId"
              name="neighborhoodId"
              defaultValue={String(initial.cityId) === cityId ? initial.neighborhoodId : ""}
              className={inputClass}
              {...aria("neighborhoodId")}
            >
              <option value="">{f.neighborhoodNone}</option>
              {hoods.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name[locale]}
                </option>
              ))}
            </select>
            <ErrorText name="neighborhoodId" message={err("neighborhoodId")} />
          </div>
        </div>
      </section>

      <section className={section} aria-labelledby="s-details">
        <h2 id="s-details" className="text-lg font-extrabold">
          {f.sectionDetails}
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <NumberInput name="areaSqm" text={f.area} value={initial.areaSqm} decimal error={err("areaSqm")} />
          {hasBedrooms && <NumberInput name="bedrooms" text={f.bedrooms} value={initial.bedrooms} error={err("bedrooms")} />}
          <NumberInput name="bathrooms" text={f.bathrooms} value={initial.bathrooms} error={err("bathrooms")} />
          <NumberInput name="floor" text={f.floor} value={initial.floor} error={err("floor")} />
        </div>
        {hasBedrooms && (
          <div className="sm:w-1/2">
            <label htmlFor="furnished" className={label}>
              {f.furnished}
            </label>
            <select id="furnished" name="furnished" defaultValue={initial.furnished} className={inputClass}>
              <option value="">{f.notSpecified}</option>
              <option value="yes">{f.yes}</option>
              <option value="no">{f.no}</option>
            </select>
          </div>
        )}
        <div>
          <label htmlFor="description" className={label}>
            {f.description} <span className="font-normal text-muted">({f.optional})</span>
          </label>
          <textarea
            id="description"
            name="description"
            defaultValue={initial.description}
            maxLength={5000}
            rows={6}
            placeholder={f.descriptionHint}
            dir="auto"
            className="w-full rounded-lg border border-border bg-surface p-3 text-base focus:border-brand focus:outline-none"
            {...aria("description")}
          />
          <ErrorText name="description" message={err("description")} />
        </div>
        <fieldset>
          <legend className={label}>{f.posterType}</legend>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            {(["owner", "agent"] as const).map((value) => (
              <label key={value} className="flex items-center gap-2">
                <input type="radio" name="posterType" value={value} defaultChecked={initial.posterType === value} className="size-5 accent-brand" />
                {value === "owner" ? f.owner : f.agent}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className={section} aria-labelledby="s-contact">
        <h2 id="s-contact" className="text-lg font-extrabold">
          {f.sectionContact}
        </h2>
        <div className="sm:w-1/2">
          <label htmlFor="phone" className={label}>
            {f.phone}
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="tel"
            placeholder={f.phoneHint}
            defaultValue={initial.phone}
            className={inputClass}
            {...aria("phone")}
          />
          <ErrorText name="phone" message={err("phone")} />
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="allowCalls" defaultChecked={initial.allowCalls} className="size-5 accent-brand" />
            {f.allowCalls}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="allowWhatsapp" defaultChecked={initial.allowWhatsapp} className="size-5 accent-brand" />
            {f.allowWhatsapp}
          </label>
          <ErrorText name="allowWhatsapp" message={err("allowWhatsapp")} />
        </div>
        <p className="text-sm text-muted">{f.contactNote}</p>
      </section>

      <div className="sm:w-80">
        <SubmitButton pendingText={f.saving} pending={pending}>{listingId ? f.saveButton : f.createButton}</SubmitButton>
      </div>
    </form>
  );
}

function NumberInput({ name, text, value, decimal, error }: { name: string; text: string; value: string; decimal?: boolean; error?: string }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-semibold">
        {text}
      </label>
      <input
        id={name}
        name={name}
        inputMode={decimal ? "decimal" : "numeric"}
        dir="ltr"
        defaultValue={value}
        className={inputClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error && (
        <p id={`${name}-error`} className="mt-1 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function ErrorText({ name, message }: { name: string; message?: string }) {
  return message ? (
    <p id={`${name}-error`} className="mt-1 text-sm font-semibold text-danger">
      {message}
    </p>
  ) : null;
}
