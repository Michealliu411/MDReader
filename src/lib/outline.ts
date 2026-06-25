import type { Heading } from "./markdown";

export type { Heading };

/**
 * 根据当前标题 id,算出从根 H1 到它的完整层级路径。
 * 父子关系:某标题的父是它前面最近的 level 更小的标题。
 */
export function buildPath(headings: Heading[], currentId: string): string[] {
  const idx = headings.findIndex((h) => h.id === currentId);
  if (idx === -1) return [];

  const current = headings[idx];
  const path: Heading[] = [current];

  // 向前找父级:level 更小的最近标题
  let targetLevel = current.level - 1;
  for (let i = idx - 1; i >= 0 && targetLevel >= 1; i--) {
    if (headings[i].level === targetLevel) {
      path.unshift(headings[i]);
      targetLevel--;
    }
  }
  return path.map((h) => h.text);
}
