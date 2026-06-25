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
