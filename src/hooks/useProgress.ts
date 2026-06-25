import { useCallback, useEffect, useRef, useState } from "react";
import { loadProgress, saveProgress } from "../lib/tauri-bridge";

export function useProgress(filePath: string | null) {
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 打开文件时恢复进度
  useEffect(() => {
    if (!filePath) {
      setRestoreId(null);
      return;
    }
    let cancelled = false;
    loadProgress(filePath)
      .then((entry) => {
        if (!cancelled && entry) setRestoreId(entry.headingId);
      })
      .catch(() => {
        // 静默失败:首次使用或文件损坏,从头开始
      });
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  // 滚动停顿 1.5s 后保存(防抖)
  const recordHeading = useCallback(
    (id: string) => {
      setActiveId(id);
      if (!filePath) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        saveProgress(filePath, id).catch(() => {
          // 静默失败:进度没存上不打断阅读
        });
      }, 1500);
    },
    [filePath],
  );

  return { restoreId, activeId, recordHeading };
}
