import { describe, it, expect } from "vitest";
import { findMatches, nextIndex, prevIndex } from "../search";

describe("findMatches", () => {
  it("找到所有匹配位置", () => {
    const matches = findMatches("ab ab ab", "ab", false);
    expect(matches).toEqual([0, 3, 6]);
  });

  it("无匹配返回空数组", () => {
    const matches = findMatches("hello", "xyz", false);
    expect(matches).toEqual([]);
  });

  it("大小写敏感开", () => {
    const matches = findMatches("Hello hello", "Hello", true);
    expect(matches).toEqual([0]);
  });

  it("大小写敏感关(默认)", () => {
    const matches = findMatches("Hello hello", "hello", false);
    expect(matches).toEqual([0, 6]);
  });

  it("空关键词返回空", () => {
    const matches = findMatches("some text", "", false);
    expect(matches).toEqual([]);
  });
});

describe("nextIndex", () => {
  it("正常前进", () => {
    expect(nextIndex([0, 3, 6], 1)).toBe(2);
  });

  it("末尾循环回开头", () => {
    expect(nextIndex([0, 3, 6], 2)).toBe(0);
  });

  it("无匹配返回 -1", () => {
    expect(nextIndex([], 0)).toBe(-1);
  });
});

describe("prevIndex", () => {
  it("正常后退", () => {
    expect(prevIndex([0, 3, 6], 2)).toBe(1);
  });

  it("开头循环回末尾", () => {
    expect(prevIndex([0, 3, 6], 0)).toBe(2);
  });

  it("无匹配返回 -1", () => {
    expect(prevIndex([], 0)).toBe(-1);
  });
});
