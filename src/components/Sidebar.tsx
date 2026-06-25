import type { Heading } from "../lib/markdown";
import type { Bookmark } from "../lib/tauri-bridge";
import { Bookmarks } from "./Bookmarks";

interface SidebarProps {
  headings: Heading[];
  activeId: string | null;
  onJump: (id: string) => void;
  bookmarks: Bookmark[];
  currentFilePath: string | null;
  bookmarkedIds: Set<string>;
  onToggleBookmark: (heading: Heading) => void;
}

export function Sidebar({
  headings,
  activeId,
  onJump,
  bookmarks,
  currentFilePath,
  bookmarkedIds,
  onToggleBookmark,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <Bookmarks
        bookmarks={bookmarks}
        currentFilePath={currentFilePath}
        onJump={onJump}
      />
      {headings.length === 0 ? (
        <p className="sidebar-empty">无大纲</p>
      ) : (
        <nav className="outline">
          {headings.map((h) => (
            <div key={h.id} className={`outline-row level-${h.level}`}>
              <a
                className={`outline-item${h.id === activeId ? " active" : ""}`}
                onClick={() => onJump(h.id)}
              >
                {h.text}
              </a>
              <button
                className={`bookmark-toggle${bookmarkedIds.has(h.id) ? " active" : ""}`}
                onClick={() => onToggleBookmark(h)}
                title="书签"
              >
                {bookmarkedIds.has(h.id) ? "📑" : "🔖"}
              </button>
            </div>
          ))}
        </nav>
      )}
    </aside>
  );
}
