import { describe, it, expect } from "vitest";
import { buildExportHtml } from "../export";

describe("buildExportHtml", () => {
  it("生成完整 HTML 文档,含内联 CSS 和内容", () => {
    const result = buildExportHtml("<h1>标题</h1><p>正文</p>", "测试.md");
    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain("<title>测试.md</title>");
    expect(result).toContain("<h1>标题</h1>");
    expect(result).toContain("<style>");
  });

  it("空内容也能生成", () => {
    const result = buildExportHtml("", "empty.md");
    expect(result).toContain("<!DOCTYPE html>");
  });
});
