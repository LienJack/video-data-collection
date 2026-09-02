"use client";

import { Label } from "@egocapture/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { useMemo, useState, useSyncExternalStore, type ChangeEvent } from "react";
import {
  allLocales,
  canonicalLocale,
  COUNTRY_PREFERENCES,
  localesForCountry,
  TIMEZONE_NAMES,
  timezonesForCountry,
} from "@egocapture/core/domain/regional-preferences";

const displayLocale = "zh-CN";
const regionNames = new Intl.DisplayNames(displayLocale, { type: "region" });
const languageNames = new Intl.DisplayNames(displayLocale, { type: "language" });
const collator = new Intl.Collator(displayLocale);
const subscribeToHydration = () => () => undefined;
const getClientHydrationState = () => true;
const getServerHydrationState = () => false;

const countryOptions = COUNTRY_PREFERENCES.map((country) => ({
  value: country.code,
  label: `${regionNames.of(country.code) ?? country.englishName} · ${country.code}`,
})).sort((left, right) => collator.compare(left.label, right.label));

const localeOptions = allLocales().map((locale) => {
  const parsed = new Intl.Locale(locale);
  const language = languageNames.of(parsed.language) ?? parsed.language;
  const region = parsed.region ? regionNames.of(parsed.region) : null;
  return {
    value: locale,
    label: `${language}${region ? `（${region}）` : ""} · ${locale}`,
  };
}).sort((left, right) => collator.compare(left.label, right.label));

const timezoneOptions = TIMEZONE_NAMES.map((timezone) => ({
  value: timezone,
  label: timezone.replaceAll("_", " "),
}));

type SelectProps = {
  name: string;
  defaultValue?: string | null;
  className: string;
  required?: boolean;
  blankLabel?: string;
  "aria-label"?: string;
};

function withCurrentValue(
  options: readonly { value: string; label: string }[],
  currentValue?: string | null,
) {
  if (!currentValue || options.some((option) => option.value === currentValue)) return options;
  return [{ value: currentValue, label: `${currentValue}（现有值）` }, ...options];
}

export function CountrySelect({
  name,
  defaultValue,
  className,
  required,
  blankLabel,
  "aria-label": ariaLabel,
}: SelectProps) {
  return (
    <NativeSelect
      name={name}
      defaultValue={defaultValue ?? ""}
      className={className}
      required={required}
      aria-label={ariaLabel}
    >
      {blankLabel ? <NativeSelectOption value="">{blankLabel}</NativeSelectOption> : null}
      {withCurrentValue(countryOptions, defaultValue).map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>{option.label}</NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

export function LocaleSelect({
  name,
  defaultValue,
  className,
  required,
  blankLabel,
  "aria-label": ariaLabel,
}: SelectProps) {
  const normalizedDefault = defaultValue ? canonicalLocale(defaultValue) ?? defaultValue : "";
  return (
    <NativeSelect
      name={name}
      defaultValue={normalizedDefault}
      className={className}
      required={required}
      aria-label={ariaLabel}
    >
      {blankLabel ? <NativeSelectOption value="">{blankLabel}</NativeSelectOption> : null}
      {withCurrentValue(localeOptions, normalizedDefault).map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>{option.label}</NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

export function TimezoneSelect({
  name,
  defaultValue,
  className,
  required,
  blankLabel,
  "aria-label": ariaLabel,
}: SelectProps) {
  return (
    <NativeSelect
      name={name}
      defaultValue={defaultValue ?? ""}
      className={className}
      required={required}
      aria-label={ariaLabel}
    >
      {blankLabel ? <NativeSelectOption value="">{blankLabel}</NativeSelectOption> : null}
      {withCurrentValue(timezoneOptions, defaultValue).map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>{option.label}</NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

export function RegionalPreferencesFields({
  defaultCountry = "CN",
  defaultLocale = "zh-CN",
  defaultTimezone = "Asia/Shanghai",
  fieldClassName,
  labelClassName,
}: {
  defaultCountry?: string | null;
  defaultLocale?: string;
  defaultTimezone?: string;
  fieldClassName: string;
  labelClassName: string;
}) {
  const ready = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationState,
    getServerHydrationState,
  );
  const [country, setCountry] = useState(defaultCountry ?? "");
  const [locale, setLocale] = useState(canonicalLocale(defaultLocale) ?? defaultLocale);
  const [timezone, setTimezone] = useState(defaultTimezone);
  const preferredLocales = useMemo(() => localesForCountry(country), [country]);
  const preferredTimezones = useMemo(() => timezonesForCountry(country), [country]);
  const visibleLocales = useMemo(() => {
    const preferred = new Set(preferredLocales);
    return [
      ...localeOptions.filter((option) => preferred.has(option.value)),
      ...localeOptions.filter((option) => !preferred.has(option.value)),
    ];
  }, [preferredLocales]);
  const visibleTimezones = useMemo(() => {
    const preferred = new Set(preferredTimezones);
    return [
      ...timezoneOptions.filter((option) => preferred.has(option.value)),
      ...timezoneOptions.filter((option) => !preferred.has(option.value)),
    ];
  }, [preferredTimezones]);

  function changeCountry(event: ChangeEvent<HTMLSelectElement>) {
    const nextCountry = event.target.value;
    const nextLocales = localesForCountry(nextCountry);
    const nextTimezones = timezonesForCountry(nextCountry);
    setCountry(nextCountry);
    if (nextLocales.length > 0) setLocale(nextLocales[0]);
    if (nextTimezones.length > 0) setTimezone(nextTimezones[0]);
  }

  return (
    <>
      <Label className={labelClassName}>
        Country / Region
        <NativeSelect name="countryRegion" required disabled={!ready} value={country} onChange={changeCountry} className={fieldClassName}>
          <NativeSelectOption value="" disabled>请选择国家或地区</NativeSelectOption>
          {withCurrentValue(countryOptions, country).map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>{option.label}</NativeSelectOption>
          ))}
        </NativeSelect>
      </Label>
      <Label className={labelClassName}>
        Locale
        <NativeSelect name="locale" required disabled={!ready} value={locale} onChange={(event) => setLocale(event.target.value)} className={fieldClassName}>
          {withCurrentValue(visibleLocales, locale).map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>{option.label}</NativeSelectOption>
          ))}
        </NativeSelect>
      </Label>
      <Label className={labelClassName}>
        Timezone
        <NativeSelect name="timezone" required disabled={!ready} value={timezone} onChange={(event) => setTimezone(event.target.value)} className={fieldClassName}>
          {withCurrentValue(visibleTimezones, timezone).map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>{option.label}</NativeSelectOption>
          ))}
        </NativeSelect>
      </Label>
    </>
  );
}
