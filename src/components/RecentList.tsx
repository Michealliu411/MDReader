import type { RecentEntry } from "../lib/tauri-bridge";

interface RecentListProps {
  entries: RecentEntry[];
  onOpen: (path: string) => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  return `${Math.floor(diff / 86400)}天前`;
}

export function RecentList({ entries, onOpen }: RecentListProps) {
  if (entries.length === 0) {
    return (
      <div className="recent-empty">
        <p>还没有打开过文件</p>
      </div>
    );
  }
  return (
    <div className="recent-list">
      <h3 className="recent-title">最近打开</h3>
      {entries.map((e) => (
        <button
          key={e.path}
          className="recent-item"
          onClick={() => onOpen(e.path)}
        >
          <span className="recent-name">📄 {e.name}</span>
          <span className="recent-time">{timeAgo(e.openedAt)}</span>
        </button>
      ))}
    </div>
  );
}
