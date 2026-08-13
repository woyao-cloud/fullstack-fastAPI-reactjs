import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkuEditor, type SkuRow } from "@/components/admin/sku-editor";

const row: SkuRow = {
  specs: { 颜色: "红" }, price: 10, skuCode: "K1", barCode: null, weight: null, images: [], isActive: true,
};

describe("SkuEditor", () => {
  it("renders rows from value", () => {
    render(<SkuEditor value={[row]} onChange={() => {}} />);
    expect(screen.getByText("SKU #1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("K1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("红")).toBeInTheDocument();
  });

  it("commits price edits as number", () => {
    const onChange = vi.fn();
    render(<SkuEditor value={[row]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("价格 *"), { target: { value: "12.5" } });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ price: 12.5 })]);
  });

  it("commits sku code edits", () => {
    const onChange = vi.fn();
    render(<SkuEditor value={[row]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("SKU 编码 *"), { target: { value: "K2" } });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ skuCode: "K2" })]);
  });

  it("adds and removes a sku row", () => {
    const onChange = vi.fn();
    render(<SkuEditor value={[row]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "添加 SKU" }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ skuCode: "K1" }),
      expect.objectContaining({ skuCode: "" }),
    ]);
    fireEvent.click(screen.getAllByRole("button", { name: "删除" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "删除" })[0]);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("edits, adds and removes spec pairs", () => {
    const onChange = vi.fn();
    render(<SkuEditor value={[row]} onChange={onChange} />);
    // 修改规格值
    fireEvent.change(screen.getByDisplayValue("红"), { target: { value: "蓝" } });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ specs: { 颜色: "蓝" } })]);
    // 新增规格对
    fireEvent.click(screen.getByRole("button", { name: "+规格" }));
    expect(screen.getAllByPlaceholderText("规格值").length).toBe(2);
    // 删除规格对
    fireEvent.click(screen.getAllByRole("button", { name: "✕" })[0]);
    expect(screen.getAllByPlaceholderText("规格值").length).toBe(1);
  });

  it("toggles active checkbox", () => {
    const onChange = vi.fn();
    render(<SkuEditor value={[row]} onChange={onChange} />);
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ isActive: false })]);
  });
});
