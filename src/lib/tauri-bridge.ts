import { invoke } from "@tauri-apps/api/core";

export async function readFile(path: string): Promise<string> {
  return invoke<string>("read_file", { path });
}

export interface ProgressEntry {
  headingId: string;
  updatedAt: number;
}

export async function saveProgress(
  path: string,
  headingId: string,
): Promise<void> {
  await invoke("save_progress", { path, headingId });
}

export async function loadProgress(
  path: string,
): Promise<ProgressEntry | null> {
  return invoke<ProgressEntry | null>("load_progress", { path });
}

// --- 最近打开 ---
export interface RecentEntry {
  path: string;
  name: string;
  openedAt: number;
}

export async function loadRecent(): Promise<RecentEntry[]> {
  return invoke<RecentEntry[]>("load_recent");
}

export async function addRecent(
  path: string,
  name: string,
): Promise<RecentEntry[]> {
  return invoke<RecentEntry[]>("add_recent", { path, name });
}

// --- 书签 ---
export interface Bookmark {
  filePath: string;
  headingId: string;
  headingText: string;
}

export async function loadBookmarks(): Promise<Bookmark[]> {
  return invoke<Bookmark[]>("load_bookmarks");
}

export async function addBookmark(
  filePath: string,
  headingId: string,
  headingText: string,
): Promise<Bookmark[]> {
  return invoke<Bookmark[]>("add_bookmark", { filePath, headingId, headingText });
}

export async function removeBookmark(
  filePath: string,
  headingId: string,
): Promise<Bookmark[]> {
  return invoke<Bookmark[]>("remove_bookmark", { filePath, headingId });
}

// --- 导出 ---
export async function writeTextFile(
  path: string,
  content: string,
): Promise<void> {
  await invoke("write_text_file", { path, content });
}
