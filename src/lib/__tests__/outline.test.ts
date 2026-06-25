import { describe, it, expect } from "vitest";
import { buildPath, type Heading } from "../outline";

const headings: Heading[] = [
  { id: "设计", level: 1, text: "设计" },
  { id: "数据流", level: 2, text: "数据流" },
  { id: "恢复进度", level: 3, text: "恢复进度" },
  { id: "错误处理", level: 2, text: "错误处理" },
  { id: "测试", level: 3, text: "测试" },
];

describe("buildPath", () => {
  it("返回从根到当前标题的完整路径", () => {
    expect(buildPath(headings, "恢复进度")).toEqual([
      "设计",
      "数据流",
      "恢复进度",
    ]);
  });

  it("H2 标题路径只含 H1 和自身", () => {
    expect(buildPath(headings, "错误处理")).toEqual(["设计", "错误处理"]);
  });

  it("H1 标题路径只含自身", () => {
    expect(buildPath(headings, "设计")).toEqual(["设计"]);
  });

  it("找不到标题返回空数组", () => {
    expect(buildPath(headings, "不存在")).toEqual([]);
  });

  it("无标题时返回空", () => {
    expect(buildPath([], "x")).toEqual([]);
  });
});
