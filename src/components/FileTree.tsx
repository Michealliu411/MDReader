import { useState } from "react";
import type { TreeNode } from "../lib/tauri-bridge";

interface FileTreeProps {
  node: TreeNode;
  currentPath: string | null;
  onOpen: (path: string) => void;
}

export function FileTree({ node, currentPath, onOpen }: FileTreeProps) {
  return (
    <nav className="file-tree">
      {node.children.map((child) => (
        <FileTreeNode
          key={child.path}
          node={child}
          depth={0}
          currentPath={currentPath}
          onOpen={onOpen}
        />
      ))}
    </nav>
  );
}

function FileTreeNode({
  node,
  depth,
  currentPath,
  onOpen,
}: {
  node: TreeNode;
  depth: number;
  currentPath: string | null;
  onOpen: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  if (node.isDir) {
    return (
      <div className="tree-node">
        <button
          className="tree-dir"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => setExpanded((e) => !e)}
        >
          <span className="tree-toggle">{expanded ? "▾" : "▸"}</span>
          <span className="tree-icon">📁</span>
          <span className="tree-name">{node.name}</span>
        </button>
        {expanded &&
          node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              currentPath={currentPath}
              onOpen={onOpen}
            />
          ))}
      </div>
    );
  }

  return (
    <button
      className={`tree-file${node.path === currentPath ? " active" : ""}`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={() => onOpen(node.path)}
    >
      <span className="tree-icon">📄</span>
      <span className="tree-name">{node.name}</span>
    </button>
  );
}
