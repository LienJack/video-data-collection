import { countries, languages, type TCountryCode } from "countries-list";
import {
  getAllTimezones,
  getCountry,
} from "countries-and-timezones";

export type CountryPreference = {
  code: string;
  englishName: string;
  nativeName: string;
  languageCodes: string[];
};

const countryCodes = Object.keys(countries).sort();
const countryCodeSet = new Set(countryCodes);
const timezoneRecords = getAllTimezones();
const timezoneNames = Object.keys(timezoneRecords).sort();
const timezoneNameSet = new Set(timezoneNames);

export const COUNTRY_PREFERENCES: readonly CountryPreference[] = countryCodes.map((code) => {
  const country = countries[code as TCountryCode];
  return {
    code,
    englishName: country.name,
    nativeName: country.native,
    languageCodes: [...country.languages],
  };
});

export const TIMEZONE_NAMES: readonly string[] = timezoneNames;

export function canonicalLocale(value: string): string | null {
  try {
    return Intl.getCanonicalLocales(value)[0] ?? null;
  } catch {
    return null;
  }
}

export function isSupportedCountryCode(value: string): boolean {
  return countryCodeSet.has(value);
}

export function isSupportedTimezone(value: string): boolean {
  return timezoneNameSet.has(value);
}

export function isCanonicalLocale(value: string): boolean {
  return canonicalLocale(value) === value;
}

export function localesForCountry(countryCode: string): string[] {
  const country = countries[countryCode as TCountryCode];
  if (!country) return [];
  const values = country.languages.flatMap((languageCode) => {
    const locale = canonicalLocale(`${languageCode}-${countryCode}`);
    return locale ? [locale] : [];
  });
  return [...new Set(values)];
}

export function allLocales(): string[] {
  const values = new Set<string>();
  for (const languageCode of Object.keys(languages)) {
    const locale = canonicalLocale(languageCode);
    if (locale) values.add(locale);
  }
  for (const countryCode of countryCodes) {
    for (const locale of localesForCountry(countryCode)) values.add(locale);
  }
  return [...values].sort();
}

export function timezonesForCountry(countryCode: string): string[] {
  return getCountry(countryCode)?.timezones ?? [];
}
