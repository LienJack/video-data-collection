import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  allLocales,
  COUNTRY_PREFERENCES,
  isCanonicalLocale,
  isSupportedCountryCode,
  isSupportedTimezone,
  timezonesForCountry,
} from "@egocapture/core/domain/regional-preferences";
import { RegionalPreferencesFields } from "../../apps/admin-web/app/_components/regional-preferences-fields";

const fieldClassName = "field";
const labelClassName = "label";

describe("regional preferences", () => {
  it("provides standard country, locale, and IANA timezone values", () => {
    expect(COUNTRY_PREFERENCES.length).toBeGreaterThan(240);
    expect(allLocales()).toContain("zh-CN");
    expect(timezonesForCountry("CN")).toContain("Asia/Shanghai");
    expect(isSupportedCountryCode("CN")).toBe(true);
    expect(isSupportedCountryCode("China")).toBe(false);
    expect(isCanonicalLocale("zh-CN")).toBe(true);
    expect(isCanonicalLocale("zh-cn")).toBe(false);
    expect(isSupportedTimezone("Asia/Shanghai")).toBe(true);
    expect(isSupportedTimezone("Shanghai")).toBe(false);
  });

  it("updates the suggested locale and timezone when the country changes", () => {
    render(
      <RegionalPreferencesFields
        fieldClassName={fieldClassName}
        labelClassName={labelClassName}
      />,
    );

    const country = screen.getByLabelText("国家 / 地区") as HTMLInputElement;
    const locale = screen.getByLabelText("语言区域") as HTMLInputElement;
    const timezone = screen.getByLabelText("时区") as HTMLInputElement;
    const countryValue = document.querySelector<HTMLInputElement>('input[type="hidden"][name="countryRegion"]');
    const localeValue = document.querySelector<HTMLInputElement>('input[type="hidden"][name="locale"]');
    const timezoneValue = document.querySelector<HTMLInputElement>('input[type="hidden"][name="timezone"]');

    expect(country).toHaveAttribute("list");
    expect(locale).toHaveAttribute("list");
    expect(timezone).toHaveAttribute("list");
    expect(countryValue?.value).toBe("CN");
    expect(localeValue?.value).toBe("zh-CN");
    expect(timezoneValue?.value).toBe("Asia/Shanghai");

    fireEvent.change(country, { target: { value: "JP" } });

    expect((screen.getByLabelText("国家 / 地区") as HTMLInputElement).value).toContain("Japan");
    expect(document.querySelector<HTMLInputElement>('input[type="hidden"][name="countryRegion"]')?.value).toBe("JP");
    expect(document.querySelector<HTMLInputElement>('input[type="hidden"][name="locale"]')?.value).toBe("ja-JP");
    expect(document.querySelector<HTMLInputElement>('input[type="hidden"][name="timezone"]')?.value).toBe("Asia/Tokyo");
  });
});
