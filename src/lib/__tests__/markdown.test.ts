import { describe, it, expect } from "vitest";
import { parse } from "../markdown";

describe("parse", () => {
  it("返回 html 和 headings", () => {
    const md = "# 标题一\n\n正文段落\n\n## 子标题\n\n更多正文";
    const { html, headings } = parse(md);

    expect(html).toContain("<h1>标题一</h1>");
    expect(html).toContain("<h2>子标题</h2>");
    expect(html).toContain("<p>正文段落</p>");
    expect(headings).toHaveLength(2);
    expect(headings[0]).toEqual({
      id: "标题一",
      level: 1,
      text: "标题一",
    });
    expect(headings[1]).toEqual({
      id: "子标题",
      level: 2,
      text: "子标题",
    });
  });

  it("只提取 H1-H4,忽略 H5/H6", () => {
    const md = "# H1\n##### H5\n###### H6";
    const { headings } = parse(md);
    expect(headings).toHaveLength(1);
    expect(headings[0].level).toBe(1);
  });

  it("代码块正常渲染(highlight.js 高亮)", () => {
    const md = "```js\nconst x = 1;\n```";
    const { html } = parse(md);
    expect(html).toContain("<code");
    // highlight.js 会把关键字/数字包进 span,检查高亮 span 存在即可
    expect(html).toContain("hljs-keyword");
    expect(html).toContain("const");
    expect(html).toContain("</code></pre>");
  });

  it("空文件不报错,返回空结果", () => {
    const { html, headings } = parse("");
    expect(html).toBe("");
    expect(headings).toHaveLength(0);
  });

  it("纯文本不报错", () => {
    const { html, headings } = parse("只是一段纯文本");
    expect(html).toContain("只是一段纯文本");
    expect(headings).toHaveLength(0);
  });
});
