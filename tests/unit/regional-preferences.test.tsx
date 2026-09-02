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

    const country = screen.getByLabelText("Country / Region") as HTMLSelectElement;
    const locale = screen.getByLabelText("Locale") as HTMLSelectElement;
    const timezone = screen.getByLabelText("Timezone") as HTMLSelectElement;

    expect(country.value).toBe("CN");
    expect(locale.value).toBe("zh-CN");
    expect(timezone.value).toBe("Asia/Shanghai");

    fireEvent.change(country, { target: { value: "JP" } });

    expect(locale.value).toBe("ja-JP");
    expect(timezone.value).toBe("Asia/Tokyo");
  });
});
