"use client";

import { Input } from "@egocapture/ui/components/input";
import { Label } from "@egocapture/ui/components/label";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useI18n } from "@egocapture/ui/lib/i18n";
import {
  allLocales,
  canonicalLocale,
  COUNTRY_PREFERENCES,
  localesForCountry,
  TIMEZONE_NAMES,
  timezonesForCountry,
} from "@egocapture/core/domain/regional-preferences";

const subscribeToHydration = () => () => undefined;
const getClientHydrationState = () => true;
const getServerHydrationState = () => false;

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
  disabled?: boolean;
  onValueChange?: (value: string) => void;
};

type SearchableSelectProps = SelectProps & {
  options: readonly { value: string; label: string }[];
};

function withCurrentValue(
  options: readonly { value: string; label: string }[],
  currentValue?: string | null,
  currentLabel = "Current value",
) {
  if (!currentValue || options.some((option) => option.value === currentValue)) return options;
  return [{ value: currentValue, label: `${currentValue} (${currentLabel})` }, ...options];
}

function normalizeSearchValue(value: string, locale: string) {
  return value.trim().toLocaleLowerCase(locale);
}

function SearchableSelect({
  name,
  defaultValue,
  className,
  required,
  blankLabel,
  "aria-label": ariaLabel,
  disabled,
  onValueChange,
  options,
}: SearchableSelectProps) {
  const i18n = useI18n();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const availableOptions = useMemo(
    () => withCurrentValue(options, defaultValue, i18n.t("adminUi.currentValue")),
    [defaultValue, i18n, options],
  );
  const initialOption = availableOptions.find((option) => option.value === defaultValue);
  const [selectedValue, setSelectedValue] = useState(defaultValue ?? "");
  const [searchValue, setSearchValue] = useState(initialOption?.label ?? "");
  const fieldLabel = ariaLabel ?? name;

  function changeSearchValue(nextSearchValue: string) {
    const normalized = normalizeSearchValue(nextSearchValue, i18n.locale);
    const match = availableOptions.find((option) => (
      normalizeSearchValue(option.label, i18n.locale) === normalized
      || normalizeSearchValue(option.value, i18n.locale) === normalized
    ));
    const nextValue = match?.value ?? "";

    setSearchValue(match?.label ?? nextSearchValue);
    setSelectedValue(nextValue);
    inputRef.current?.setCustomValidity(
      normalized && !match ? i18n.t("adminUi.chooseSuggestion", { field: fieldLabel }) : "",
    );
    if (match || !normalized) onValueChange?.(nextValue);
  }

  return (
    <span className="relative block w-full">
      <MagnifyingGlass
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref={inputRef}
        type="search"
        list={listId}
        value={searchValue}
        onChange={(event) => changeSearchValue(event.target.value)}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        placeholder={blankLabel ?? i18n.t("adminUi.searchField", { field: fieldLabel })}
        className={`${className} pl-10 pr-3`}
        required={required}
        disabled={disabled}
      />
      <input type="hidden" name={name} value={selectedValue} disabled={disabled} />
      <datalist id={listId}>
        {availableOptions.map((option) => (
          <option key={option.value} value={option.label} />
        ))}
      </datalist>
    </span>
  );
}

export function CountrySelect({
  name,
  defaultValue,
  className,
  required,
  blankLabel,
  "aria-label": ariaLabel,
  disabled,
  onValueChange,
}: SelectProps) {
  const i18n = useI18n();
  const options = useMemo(() => {
    const collator = new Intl.Collator(i18n.locale);
    return COUNTRY_PREFERENCES.map((country) => ({
      value: country.code,
      label: `${i18n.regionName(country.code)} / ${country.englishName} · ${country.code}`,
    })).sort((left, right) => collator.compare(left.label, right.label));
  }, [i18n]);
  return (
    <SearchableSelect
      name={name}
      defaultValue={defaultValue}
      className={className}
      required={required}
      aria-label={ariaLabel}
      blankLabel={blankLabel}
      disabled={disabled}
      onValueChange={onValueChange}
      options={options}
    />
  );
}

export function LocaleSelect({
  name,
  defaultValue,
  className,
  required,
  blankLabel,
  "aria-label": ariaLabel,
  disabled,
  onValueChange,
}: SelectProps) {
  const i18n = useI18n();
  const options = useMemo(() => {
    const collator = new Intl.Collator(i18n.locale);
    return allLocales().map((locale) => {
      const parsed = new Intl.Locale(locale);
      const language = i18n.languageName(parsed.language);
      const region = parsed.region ? i18n.regionName(parsed.region) : null;
      return { value: locale, label: `${language}${region ? ` (${region})` : ""} · ${locale}` };
    }).sort((left, right) => collator.compare(left.label, right.label));
  }, [i18n]);
  const normalizedDefault = defaultValue ? canonicalLocale(defaultValue) ?? defaultValue : "";
  return (
    <SearchableSelect
      name={name}
      defaultValue={normalizedDefault}
      className={className}
      required={required}
      aria-label={ariaLabel}
      blankLabel={blankLabel}
      disabled={disabled}
      onValueChange={onValueChange}
      options={options}
    />
  );
}

export function TimezoneSelect({
  name,
  defaultValue,
  className,
  required,
  blankLabel,
  "aria-label": ariaLabel,
  disabled,
  onValueChange,
}: SelectProps) {
  return (
    <SearchableSelect
      name={name}
      defaultValue={defaultValue}
      className={className}
      required={required}
      aria-label={ariaLabel}
      blankLabel={blankLabel}
      disabled={disabled}
      onValueChange={onValueChange}
      options={timezoneOptions}
    />
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
  const i18n = useI18n();
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
  const localeOptions = useMemo(() => {
    const collator = new Intl.Collator(i18n.locale);
    return allLocales().map((optionLocale) => {
      const parsed = new Intl.Locale(optionLocale);
      const language = i18n.languageName(parsed.language);
      const region = parsed.region ? i18n.regionName(parsed.region) : null;
      return { value: optionLocale, label: `${language}${region ? ` (${region})` : ""} · ${optionLocale}` };
    }).sort((left, right) => collator.compare(left.label, right.label));
  }, [i18n]);
  const visibleLocales = useMemo(() => {
    const preferred = new Set(preferredLocales);
    return [
      ...localeOptions.filter((option) => preferred.has(option.value)),
      ...localeOptions.filter((option) => !preferred.has(option.value)),
    ];
  }, [localeOptions, preferredLocales]);
  const visibleTimezones = useMemo(() => {
    const preferred = new Set(preferredTimezones);
    return [
      ...timezoneOptions.filter((option) => preferred.has(option.value)),
      ...timezoneOptions.filter((option) => !preferred.has(option.value)),
    ];
  }, [preferredTimezones]);

  function changeCountry(nextCountry: string) {
    const nextLocales = localesForCountry(nextCountry);
    const nextTimezones = timezonesForCountry(nextCountry);
    setCountry(nextCountry);
    if (nextLocales.length > 0) setLocale(nextLocales[0]);
    if (nextTimezones.length > 0) setTimezone(nextTimezones[0]);
  }

  return (
    <>
      <Label className={labelClassName}>
        {i18n.t("adminUi.countryRegion")}
        <CountrySelect
          key={`country-${country}`}
          name="countryRegion"
          required
          disabled={!ready}
          defaultValue={country}
          onValueChange={changeCountry}
          className={fieldClassName}
          aria-label={i18n.t("adminUi.countryRegion")}
        />
      </Label>
      <Label className={labelClassName}>
        {i18n.t("adminUi.locale")}
        <SearchableSelect
          key={`locale-${country}-${locale}`}
          name="locale"
          required
          disabled={!ready}
          defaultValue={locale}
          onValueChange={setLocale}
          className={fieldClassName}
          aria-label={i18n.t("adminUi.locale")}
          options={visibleLocales}
        />
      </Label>
      <Label className={labelClassName}>
        {i18n.t("adminUi.timezone")}
        <SearchableSelect
          key={`timezone-${country}-${timezone}`}
          name="timezone"
          required
          disabled={!ready}
          defaultValue={timezone}
          onValueChange={setTimezone}
          className={fieldClassName}
          aria-label={i18n.t("adminUi.timezone")}
          options={visibleTimezones}
        />
      </Label>
    </>
  );
}
