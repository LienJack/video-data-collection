import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { TagSelectField } from "../../apps/admin-web/app/(console)/tasks/task-form-fields";

afterEach(cleanup);

function MustShowHarness() {
  const [values, setValues] = useState(["参与者双手"]);
  return (
    <TagSelectField
      id="must-show"
      label="必须展示"
      values={values}
      presets={["参与者双手", "完整操作过程"]}
      onChange={setValues}
      customPlaceholder="例如：咖啡制作过程"
    />
  );
}

describe("task form tag select", () => {
  it("adds preset and custom options and removes a selected option", () => {
    render(<MustShowHarness />);

    fireEvent.change(screen.getByLabelText("从预设中添加"), { target: { value: "完整操作过程" } });
    expect(screen.getByRole("list", { name: "已选必须展示" })).toHaveTextContent("完整操作过程");

    fireEvent.change(screen.getByLabelText("添加自定义选项"), { target: { value: "咖啡杯" } });
    fireEvent.click(screen.getByRole("button", { name: "添加自定义必须展示" }));
    expect(screen.getByRole("list", { name: "已选必须展示" })).toHaveTextContent("咖啡杯");

    fireEvent.click(screen.getByRole("button", { name: "从必须展示中移除“参与者双手”" }));
    expect(screen.queryByRole("button", { name: "从必须展示中移除“参与者双手”" })).not.toBeInTheDocument();
  });

  it("rejects duplicate custom options", () => {
    render(<MustShowHarness />);

    fireEvent.change(screen.getByLabelText("添加自定义选项"), { target: { value: " 参与者双手 " } });
    fireEvent.click(screen.getByRole("button", { name: "添加自定义必须展示" }));

    expect(screen.getByText("“参与者双手”已经添加")).toBeVisible();
  });
});
