import { describe, expect, it } from "vitest";
import {
  assertCatalogParity,
  catalogs,
  createTranslator,
  DEFAULT_LOCALE,
  mapToUiLocale,
  negotiateLocale,
  resolveUiLocale,
  SUPPORTED_LOCALES,
} from "@egocapture/core/i18n";

describe("i18n locale contract", () => {
  it("supports exactly simplified Chinese, English, and Japanese", () => {
    expect(SUPPORTED_LOCALES).toEqual(["zh-CN", "en", "ja"]);
    expect(DEFAULT_LOCALE).toBe("zh-CN");
    expect(mapToUiLocale("zh-Hant-HK")).toBe("zh-CN");
    expect(mapToUiLocale("en-US")).toBe("en");
    expect(mapToUiLocale("ja-JP")).toBe("ja");
    expect(mapToUiLocale("fr-FR")).toBeNull();
  });

  it("negotiates quality values and preserves the required precedence", () => {
    expect(negotiateLocale("fr-FR, ja-JP;q=0.9, en-US;q=0.8")).toBe("ja");
    expect(resolveUiLocale({ cookie: "en", profile: "ja-JP", acceptLanguage: "zh-CN" })).toBe("en");
    expect(resolveUiLocale({ cookie: "fr", profile: "ja-JP", acceptLanguage: "en-US" })).toBe("ja");
    expect(resolveUiLocale({ profile: "ja-JP", acceptLanguage: "en-US" })).toBe("ja");
    expect(resolveUiLocale({ acceptLanguage: "en-GB" })).toBe("en");
    expect(resolveUiLocale({ acceptLanguage: "fr-FR" })).toBe("zh-CN");
  });

  it("keeps all catalog keys, placeholders, state labels, and actions in parity", () => {
    expect(() => assertCatalogParity()).not.toThrow();
  });
});

describe("i18n translator", () => {
  it("interpolates, pluralizes, and keeps raw machine values separate from labels", () => {
    const english = createTranslator("en");
    expect(english.t("common.pageOf", { page: 2, pages: 5 })).toBe("Page 2 of 5");
    expect(english.plural("common.files", 1)).toBe("1 file");
    expect(english.plural("common.files", 3)).toBe("3 files");
    expect(english.state("assignment.status", "needs_review")).toBe("Needs review");
    expect(english.label("deviceConsistency", "metadata_unavailable")).toBe("Metadata unavailable");
    expect(english.label("captureTimeSource", "local_modified")).toBe("Local modification time");
    expect("needs_review").toBe("needs_review");
  });

  it("formats region, language, dates, numbers, bytes, and duration by locale", () => {
    const japanese = createTranslator("ja");
    expect(japanese.regionName("US")).not.toBe("US");
    expect(japanese.languageName("en")).not.toBe("en");
    expect(japanese.regionName("Demo Region")).toBe("Demo Region");
    expect(japanese.languageName("not-a-locale")).toBe("not-a-locale");
    expect(japanese.number(12345)).toContain("12,345");
    expect(japanese.bytes(2048)).toBeTruthy();
    expect(japanese.duration(120)).toContain("2");
    expect(japanese.date("2026-09-03T08:00:00.000Z", { year: "numeric" })).toContain("2026");
  });

  it("returns readable localized API errors and a localized unknown fallback", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const translator = createTranslator(locale);
      expect(translator.error("INVALID_CREDENTIALS")).toBe(catalogs[locale].errors.INVALID_CREDENTIALS);
      expect(translator.error("NOT_A_REAL_CODE")).toBe(catalogs[locale].errors.UNKNOWN);
      expect(translator.error("INVALID_CREDENTIALS")).not.toBe("INVALID_CREDENTIALS");
    }
  });

  it("does not leak audit identifiers into generated Japanese labels", () => {
    for (const message of Object.values(catalogs.ja.labels.auditAction)) {
      expect(message).not.toMatch(/[a-z]{3,}/i);
    }
  });
});
