import type { Bookmark } from "../lib/tauri-bridge";

interface BookmarksProps {
  bookmarks: Bookmark[];
  currentFilePath: string | null;
  onJump: (headingId: string) => void;
}

export function Bookmarks({
  bookmarks,
  currentFilePath,
  onJump,
}: BookmarksProps) {
  // 只显示当前文件的书签
  const fileBookmarks = bookmarks.filter(
    (b) => b.filePath === currentFilePath,
  );
  if (fileBookmarks.length === 0) return null;
  return (
    <div className="bookmarks-section">
      <h4 className="bookmarks-title">📑 书签</h4>
      {fileBookmarks.map((b) => (
        <button
          key={b.headingId}
          className="bookmark-item"
          onClick={() => onJump(b.headingId)}
        >
          {b.headingText}
        </button>
      ))}
    </div>
  );
}
