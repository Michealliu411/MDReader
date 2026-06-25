import { describe, it, expect, beforeEach, vi } from "vitest";
import { getInitialTheme, applyTheme, toggleTheme } from "../theme";

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("无存储偏好时跟随系统(亮色)", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: false,
      media: q,
    }));
    expect(getInitialTheme()).toBe("light");
  });

  it("无存储偏好时跟随系统(暗色)", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: q.includes("dark"),
      media: q,
    }));
    expect(getInitialTheme()).toBe("dark");
  });

  it("有存储偏好时用存储值", () => {
    localStorage.setItem("md-reader-theme", "dark");
    expect(getInitialTheme()).toBe("dark");
  });

  it("applyTheme 设置 data-theme 属性", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("toggleTheme 在 light/dark 间切换", () => {
    expect(toggleTheme("light")).toBe("dark");
    expect(toggleTheme("dark")).toBe("light");
  });
});
