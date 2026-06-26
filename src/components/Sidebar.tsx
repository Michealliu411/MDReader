import type { TreeNode, Bookmark } from "../lib/tauri-bridge";
import { Bookmarks } from "./Bookmarks";
import { FileTree } from "./FileTree";

interface SidebarProps {
  tree: TreeNode | null;
  currentPath: string | null;
  onOpenFile: (path: string) => void;
  bookmarks: Bookmark[];
  currentFilePath: string | null;
  onJumpBookmark: (headingId: string) => void;
}

export function Sidebar({
  tree,
  currentPath,
  onOpenFile,
  bookmarks,
  currentFilePath,
  onJumpBookmark,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <Bookmarks
        bookmarks={bookmarks}
        currentFilePath={currentFilePath}
        onJump={onJumpBookmark}
      />
      {tree ? (
        <FileTree node={tree} currentPath={currentPath} onOpen={onOpenFile} />
      ) : (
        <p className="sidebar-empty">点击 📂 打开文件夹</p>
      )}
    </aside>
  );
}
